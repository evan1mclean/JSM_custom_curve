#include "Telemetry.h"

#include <algorithm>
#include <chrono>
#include <cstring>
#include <sstream>
#include <string>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace
{

#ifdef _WIN32
using SocketHandle = SOCKET;
constexpr SocketHandle kInvalidSocket = INVALID_SOCKET;
#else
using SocketHandle = int;
constexpr SocketHandle kInvalidSocket = -1;
#endif

constexpr const char *kLoopback = "127.0.0.1";

class TelemetryEmitter
{
public:
	static TelemetryEmitter &Instance()
	{
		static TelemetryEmitter emitter;
		return emitter;
	}

	void configure(bool enabled, uint16_t port)
	{
		if (_enabled == enabled && (!_enabled || port == _port))
		{
			return;
		}

		_enabled = enabled;
		_port = port;
		_nextSend = std::chrono::steady_clock::time_point::min();
		closeSocket();
	}

	void shutdown()
	{
		_enabled = false;
		closeSocket();
	}

	void maybeSend(const TelemetrySample &sample)
	{
		if (!_enabled)
		{
			return;
		}

		const auto now = std::chrono::steady_clock::now();
		const auto minInterval = std::chrono::microseconds(1000000 / Telemetry::kMaxRateHz);
		if (now < _nextSend)
		{
			return;
		}

		if (!ensureSocket())
		{
			return;
		}

		_nextSend = now + minInterval;

		std::ostringstream oss;
		oss.setf(std::ios::fixed, std::ios::floatfield);
		oss.precision(4);
		oss << "{"
		    << "\"protoVer\":" << Telemetry::kProtoVersion
		    << ",\"ts\":" << sample.timestampMs
		    << ",\"omega\":" << sample.omega
		    << ",\"t\":" << sample.normalized
		    << ",\"u\":" << sample.normalizedPostCurve
		    << ",\"sensX\":" << sample.sensX
		    << ",\"sensY\":" << sample.sensY
		    << ",\"minThr\":" << sample.minThreshold
		    << ",\"maxThr\":" << sample.maxThreshold
		    << ",\"SminX\":" << sample.sMinX
		    << ",\"SmaxX\":" << sample.sMaxX
		    << ",\"SminY\":" << sample.sMinY
		    << ",\"SmaxY\":" << sample.sMaxY
		    << ",\"curve\":\"" << sample.curve << "\""
		    << ",\"params\":" << (sample.paramsJson.empty() ? "{}" : sample.paramsJson);

		if (!sample.devices.empty())
		{
			oss << ",\"devices\":[";
			for (size_t i = 0; i < sample.devices.size(); ++i)
			{
				const auto &dev = sample.devices[i];
				if (i > 0)
				{
					oss << ",";
				}
				oss << "{"
				    << "\"handle\":" << dev.handle
				    << ",\"type\":" << dev.controllerType
				    << ",\"split\":" << dev.splitType
				    << ",\"vid\":" << dev.vendorId
				    << ",\"pid\":" << dev.productId
				    << "}";
			}
			oss << "]";
		}

		oss << "}";

		const auto payload = oss.str();
		sendto(_socket, payload.c_str(), static_cast<int>(payload.size()), 0, reinterpret_cast<sockaddr *>(&_target), sizeof(_target));
	}

private:
	bool ensureSocket()
	{
		if (!_enabled)
		{
			return false;
		}

		if (_socket != kInvalidSocket && ntohs(_target.sin_port) == _port)
		{
			return true;
		}

		closeSocket();

#ifdef _WIN32
		if (!_wsaStarted)
		{
			WSADATA data;
			if (WSAStartup(MAKEWORD(2, 2), &data) != 0)
			{
				return false;
			}
			_wsaStarted = true;
		}
#endif

		_socket = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
		if (_socket == kInvalidSocket)
		{
			return false;
		}

		std::memset(&_target, 0, sizeof(_target));
		_target.sin_family = AF_INET;
		_target.sin_port = htons(_port);
#ifdef _WIN32
		if (InetPtonA(AF_INET, kLoopback, &_target.sin_addr) != 1)
		{
			closeSocket();
			return false;
		}
#else
		if (inet_pton(AF_INET, kLoopback, &_target.sin_addr) != 1)
		{
			closeSocket();
			return false;
		}
#endif

		return true;
	}

	void closeSocket()
	{
		if (_socket != kInvalidSocket)
		{
#ifdef _WIN32
			closesocket(_socket);
#else
			::close(_socket);
#endif
			_socket = kInvalidSocket;
		}
#ifdef _WIN32
		if (_wsaStarted)
		{
			WSACleanup();
			_wsaStarted = false;
		}
#endif
	}

	bool _enabled = false;
	uint16_t _port = Telemetry::kDefaultPort;
	SocketHandle _socket = kInvalidSocket;
	sockaddr_in _target {};
	std::chrono::steady_clock::time_point _nextSend = std::chrono::steady_clock::time_point::min();
#ifdef _WIN32
	bool _wsaStarted = false;
#endif
};

uint64_t TimestampNowMs()
{
	using namespace std::chrono;
	return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
}

} // namespace

namespace Telemetry
{

void Configure(bool enabled, uint16_t port)
{
	TelemetryEmitter::Instance().configure(enabled, port);
}

void Shutdown()
{
	TelemetryEmitter::Instance().shutdown();
}

void MaybeSend(const TelemetrySample &sample)
{
	TelemetrySample enriched = sample;
	if (enriched.timestampMs == 0)
	{
		enriched.timestampMs = TimestampNowMs();
	}
	TelemetryEmitter::Instance().maybeSend(enriched);
}

} // namespace Telemetry
