#pragma once

#include <cstdint>
#include <string>
#include <vector>

struct TelemetryDevice
{
	int handle = 0;
	int controllerType = 0;
	int splitType = 0;
	int vendorId = 0;
	int productId = 0;
};

struct TelemetrySample
{
	uint64_t timestampMs = 0;
	float omega = 0.0f;
	float normalized = 0.0f;
	float normalizedPostCurve = 0.0f;
	float sensX = 0.0f;
	float sensY = 0.0f;
	float minThreshold = 0.0f;
	float maxThreshold = 0.0f;
	float sMinX = 0.0f;
	float sMaxX = 0.0f;
	float sMinY = 0.0f;
	float sMaxY = 0.0f;
	std::string curve = "LINEAR";
	std::string paramsJson = "{}";
	std::vector<TelemetryDevice> devices;
};

namespace Telemetry
{

constexpr int kProtoVersion = 2;
constexpr int kDefaultPort = 8974;
constexpr int kMaxRateHz = 120;

void Configure(bool enabled, uint16_t port);
void Shutdown();
void MaybeSend(const TelemetrySample &sample);

} // namespace Telemetry
