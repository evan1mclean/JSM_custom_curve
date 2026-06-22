#include "JSMVariable.hpp"
#include "JslWrapper.h"
#include "JSMVariable.hpp"
 #include "TriggerEffectGenerator.h"
#include "SettingsManager.h"
#include "SDL3/SDL.h"
#include <map>
#include <mutex>
#include <atomic>
#define _USE_MATH_DEFINES
#include <math.h> // M_PI
#include <algorithm>
#include <memory>
#include <iostream>
#include <cstring>
#include <span>

#ifdef __linux__
#include <fcntl.h>
#include <unistd.h>
#include <linux/input.h>
#include <sys/ioctl.h>
#include <dirent.h>
#include <libevdev/libevdev.h>
#include <libevdev/libevdev-uinput.h>
#endif

typedef struct
{
	Uint8 ucEnableBits1;              /* 0 */
	Uint8 ucEnableBits2;              /* 1 */
	Uint8 ucRumbleRight;              /* 2 */
	Uint8 ucRumbleLeft;               /* 3 */
	Uint8 ucHeadphoneVolume;          /* 4 */
	Uint8 ucSpeakerVolume;            /* 5 */
	Uint8 ucMicrophoneVolume;         /* 6 */
	Uint8 ucAudioEnableBits;          /* 7 */
	Uint8 ucMicLightMode;             /* 8 */
	Uint8 ucAudioMuteBits;            /* 9 */
	Uint8 rgucRightTriggerEffect[11]; /* 10 */
	Uint8 rgucLeftTriggerEffect[11];  /* 21 */
	Uint8 rgucUnknown1[6];            /* 32 */
	Uint8 ucLedFlags;                 /* 38 */
	Uint8 rgucUnknown2[2];            /* 39 */
	Uint8 ucLedAnim;                  /* 41 */
	Uint8 ucLedBrightness;            /* 42 */
	Uint8 ucPadLights;                /* 43 */
	Uint8 ucLedRed;                   /* 44 */
	Uint8 ucLedGreen;                 /* 45 */
	Uint8 ucLedBlue;                  /* 46 */
} DS5EffectsState_t;

struct ControllerDevice
{
	ControllerDevice(int id)
	  : _has_accel(false)
	  , _has_gyro(false)
	  , _vendorId(JS_VENDOR_UNKNOWN)
	  , _productId(JS_PRODUCT_UNKNOWN)
	{
		_has_trackpads = false;
		memset(_trackpads_state, 0, sizeof(_trackpads_state));
		memset(_prev_trackpads_state, 0, sizeof(_prev_trackpads_state));

		if (SDL_IsGamepad(id))
		{
			_sdlController = nullptr;
			for (int retry = 3; retry > 0 && _sdlController == nullptr; --retry)
			{
				_sdlController = SDL_OpenGamepad(id);

				if (_sdlController == nullptr)
				{
					CERR << SDL_GetError() << ". Trying again!\n";
					SDL_Delay(1000);
				}
				else
				{
					_has_gyro = SDL_GamepadHasSensor(_sdlController, SDL_SENSOR_GYRO);
					_has_accel = SDL_GamepadHasSensor(_sdlController, SDL_SENSOR_ACCEL);

					if (_has_gyro)
					{
						SDL_SetGamepadSensorEnabled(_sdlController, SDL_SENSOR_GYRO, true);
					}
					if (_has_accel)
					{
						SDL_SetGamepadSensorEnabled(_sdlController, SDL_SENSOR_ACCEL, true);
					}

					// Initialize touchpads/trackpads
					int num_trackpads = SDL_GetNumGamepadTouchpads(_sdlController);
					num_trackpads = clamp(num_trackpads, 0, 2);
					if (num_trackpads > 0)
					{
						// Two configurations supported:
						// 1. One touchpad, up to two fingers simultaneously.
						// 2. Two trackpads, only one finger per trackpad.
						const int max_fingers = (num_trackpads == 1 ? 2 : 1);
						for (int i = 0; i < num_trackpads; i++)
						{
							int num_fingers = SDL_GetNumGamepadTouchpadFingers(_sdlController, i);
							num_fingers = clamp(num_fingers, 0, max_fingers);
							if (num_fingers > 0)
							{
								_has_trackpads = true;
								_trackpads_state[i].enabled = true;
								for (int j = 0; j < num_fingers; j++)
								{
									_trackpads_state[i].fingers[j].enabled = true;
								}
							}
						}

						if (_has_trackpads)
						{
							if (num_trackpads == 2)
							{
								// Left trackpad settings
								trackpad_state_t *left_trackpad = &_trackpads_state[0];
								left_trackpad->grid_start = FIRST_LTP_BUTTON;
								left_trackpad->grid_end = LAST_LTP_BUTTON;
								left_trackpad->mode = SettingID::LTP_MODE;
								left_trackpad->grid_size = SettingID::LTP_GRID_SIZE;
								left_trackpad->mouse_sens = SettingID::LTP_SENS;

								// Right trackpad settings
								trackpad_state_t *right_trackpad = &_trackpads_state[1];
								right_trackpad->grid_start = FIRST_RTP_BUTTON;
								right_trackpad->grid_end = LAST_RTP_BUTTON;
								right_trackpad->mode = SettingID::RTP_MODE;
								right_trackpad->grid_size = SettingID::RTP_GRID_SIZE;
								right_trackpad->mouse_sens = SettingID::RTP_SENS;
							}
							else // num_trackpads == 1
							{
								// Touchpad settings
								trackpad_state_t *touchpad = &_trackpads_state[0];
								touchpad->grid_start = FIRST_TOUCH_BUTTON;
								touchpad->grid_end = LAST_TOUCH_BUTTON;
								touchpad->mode = SettingID::TOUCHPAD_MODE;
								touchpad->grid_size = SettingID::GRID_SIZE;
								touchpad->mouse_sens = SettingID::TOUCHPAD_SENS;
							}
							memcpy(_prev_trackpads_state, _trackpads_state, sizeof(_prev_trackpads_state));
						}
					}

					_vendorId = SDL_GetGamepadVendor(_sdlController);
					_productId = SDL_GetGamepadProduct(_sdlController);
					_guid = SDL_GetJoystickGUID(SDL_GetGamepadJoystick(_sdlController));
					_ctrlr_type = JS_TYPE_UNKNOWN;

					switch (_vendorId)
					{
					case JS_VENDOR_8BITDO:
						switch (_productId)
						{
						case JS_PRODUCT_8BITDO_SF30_PRO:
							_ctrlr_type = JS_TYPE_8BITDO_SF30_PRO;
							break;
						case JS_PRODUCT_8BITDO_SF30_PRO_BT:
							_ctrlr_type = JS_TYPE_8BITDO_SF30_PRO_BT;
							break;
						case JS_PRODUCT_8BITDO_SN30_PRO:
							_ctrlr_type = JS_TYPE_8BITDO_SN30_PRO;
							break;
						case JS_PRODUCT_8BITDO_SN30_PRO_BT:
							_ctrlr_type = JS_TYPE_8BITDO_SN30_PRO_BT;
							break;
						case JS_PRODUCT_8BITDO_PRO_2:
							_ctrlr_type = JS_TYPE_8BITDO_PRO_2;
							break;
						case JS_PRODUCT_8BITDO_PRO_2_BT:
							_ctrlr_type = JS_TYPE_8BITDO_PRO_2_BT;
							break;
						case JS_PRODUCT_8BITDO_PRO_3:
							_ctrlr_type = JS_TYPE_8BITDO_PRO_3;
							break;
						case JS_PRODUCT_8BITDO_ULTIMATE2_WIRELESS:
							_ctrlr_type = JS_TYPE_8BITDO_ULTIMATE2_WIRELESS;
							break;
						}
						break;
					case JS_VENDOR_HORI:
						if (_productId == JS_PRODUCT_HORI_STEAM_CONTROLLER ||
							_productId == JS_PRODUCT_HORI_STEAM_CONTROLLER_BT)
						{
							_ctrlr_type = JS_TYPE_HORI_STEAM;
						}
						break;
					case JS_VENDOR_FLYDIGI_V1:
					case JS_VENDOR_FLYDIGI_V2:
						if ((_vendorId == JS_VENDOR_FLYDIGI_V1 &&
							 _productId == JS_PRODUCT_FLYDIGI_V1_GAMEPAD) ||
							(_vendorId == JS_VENDOR_FLYDIGI_V2 &&
							 (_productId == JS_PRODUCT_FLYDIGI_V2_APEX ||
							  _productId == JS_PRODUCT_FLYDIGI_V2_VADER)))
						{
							switch (_guid.data[15])
							{
							case JS_FLYDIGI_APEX5:
								_ctrlr_type = JS_TYPE_FLYDIGI_APEX5;
								break;
							case JS_FLYDIGI_VADER3_PRO:
								_ctrlr_type = JS_TYPE_FLYDIGI_VADER3_PRO;
								break;
							case JS_FLYDIGI_VADER4_PRO:
								_ctrlr_type = JS_TYPE_FLYDIGI_VADER4_PRO;
								break;
							case JS_FLYDIGI_VADER5_PRO:
								_ctrlr_type = JS_TYPE_FLYDIGI_VADER5_PRO;
								break;
							}
						}
						break;
					case JS_VENDOR_GAMESIR:
						if (_productId == JS_PRODUCT_GAMESIR_GAMEPAD_G7_PRO_8K &&
							_guid.data[0] == JS_HARDWARE_BUS_USB) // No extended features over Bluetooth
						{
							_ctrlr_type = JS_TYPE_G7_PRO_8K;
						}
						break;
					case JS_VENDOR_NINTENDO:
						if (_productId == JS_PRODUCT_NINTENDO_SWITCH2_PRO)
						{
							_ctrlr_type = JS_TYPE_SWITCH2_PRO_CONTROLLER;
						}
						break;
					case JS_VENDOR_VALVE:
						switch (_productId)
						{
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_CHELL:
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_D0G_WIRED:
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_D0G_BT:
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_D0G_BT2:
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_WIRELESS:
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_V2_HEADCRAB_WIRED:
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_V2_HEADCRAB_BT:
							_ctrlr_type = JS_TYPE_STEAM_CONTROLLER;
							break;
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_NEPTUNE:
							_ctrlr_type = JS_TYPE_STEAM_DECK;
							break;
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_TRITON:
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_TRITON_BLE:
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_TRITON_PROTEUS:
						case JS_PRODUCT_VALVE_STEAM_CONTROLLER_TRITON_NEREID:
							_ctrlr_type = JS_TYPE_STEAM_CONTROLLER_TRITON;
							break;
						}
						break;
					}

					if (_ctrlr_type != JS_TYPE_UNKNOWN)
					{
						continue;
					}

					auto sdl_ctrlr_type = SDL_GetGamepadType(_sdlController);
					switch (sdl_ctrlr_type)
					{
					case SDL_GamepadType::SDL_GAMEPAD_TYPE_NINTENDO_SWITCH_JOYCON_LEFT:
						_ctrlr_type = JS_TYPE_JOYCON_LEFT;
						_split_type = JS_SPLIT_TYPE_LEFT;
						break;
					case SDL_GamepadType::SDL_GAMEPAD_TYPE_NINTENDO_SWITCH_JOYCON_RIGHT:
						_ctrlr_type = JS_TYPE_JOYCON_RIGHT;
						_split_type = JS_SPLIT_TYPE_RIGHT;
						break;
					case SDL_GamepadType::SDL_GAMEPAD_TYPE_NINTENDO_SWITCH_JOYCON_PAIR:
					case SDL_GamepadType::SDL_GAMEPAD_TYPE_NINTENDO_SWITCH_PRO:
						_ctrlr_type = JS_TYPE_PRO_CONTROLLER;
						break;
					case SDL_GamepadType::SDL_GAMEPAD_TYPE_PS4:
						_ctrlr_type = JS_TYPE_DS4;
						break;
					case SDL_GamepadType::SDL_GAMEPAD_TYPE_PS5:
						_ctrlr_type = JS_TYPE_DS;
						break;
					case SDL_GamepadType::SDL_GAMEPAD_TYPE_XBOXONE:
						_ctrlr_type = JS_TYPE_XBOXONE;
						switch (_vendorId)
						{
						case JS_VENDOR_PDP:
						case JS_VENDOR_POWERA:
							_ctrlr_type = JS_TYPE_XBOX_SERIES;
							break;
						case JS_VENDOR_MICROSOFT:
							switch (_productId)
							{
							case JS_PRODUCT_XBOX_ONE_ELITE_SERIES_1:
							case JS_PRODUCT_XBOX_ONE_ELITE_SERIES_2:
							case JS_PRODUCT_XBOX_ONE_ELITE_SERIES_2_BLUETOOTH:
							case JS_PRODUCT_XBOX_ONE_ELITE_SERIES_2_BLE:
							case JS_PRODUCT_XBOX_ONE_XBOXGIP_CONTROLLER:
								_ctrlr_type = JS_TYPE_XBOXONE_ELITE;
								break;
							case JS_PRODUCT_XBOX_SERIES_X:
							case JS_PRODUCT_XBOX_SERIES_X_BLE:
								_ctrlr_type = JS_TYPE_XBOX_SERIES;
								break;
							}
							break;
						}
						break;
					}
				}// next attempt?
			}
		}
	}

	virtual ~ControllerDevice()
	{
		_micLight = 0;
		memset(&_leftTriggerEffect, 0, sizeof(_leftTriggerEffect));
		memset(&_rightTriggerEffect, 0, sizeof(_rightTriggerEffect));
		_big_rumble = 0;
		_small_rumble = 0;
		SendEffect();
		SDL_CloseGamepad(_sdlController);
	}

	inline bool isValid()
	{
		return _sdlController != nullptr;
	}

private:
	void LoadTriggerEffect(uint8_t *rgucTriggerEffect, const AdaptiveTriggerSetting *trigger_effect)
	{
		using namespace ExtendInput::DataTools::DualSense;
		rgucTriggerEffect[0] = (uint8_t)trigger_effect->mode;
		switch (trigger_effect->mode)
		{
		case AdaptiveTriggerMode::RESISTANCE_RAW:
		{
			TriggerEffectGenerator::Simple_Feedback(rgucTriggerEffect, 0, trigger_effect->start, trigger_effect->force);
		}
		break;
		case AdaptiveTriggerMode::SEGMENT:
			rgucTriggerEffect[1] = trigger_effect->start;
			rgucTriggerEffect[2] = trigger_effect->end;
			rgucTriggerEffect[3] = trigger_effect->force;
			break;
		case AdaptiveTriggerMode::RESISTANCE:
			TriggerEffectGenerator::Feedback(rgucTriggerEffect, 0, trigger_effect->start, trigger_effect->force);
			break;
		case AdaptiveTriggerMode::BOW:
			TriggerEffectGenerator::Bow(rgucTriggerEffect, 0, trigger_effect->start, trigger_effect->end, trigger_effect->force, trigger_effect->forceExtra);
			break;
		case AdaptiveTriggerMode::GALLOPING:
			TriggerEffectGenerator::Galloping(rgucTriggerEffect, 0, trigger_effect->start, trigger_effect->end, trigger_effect->force, trigger_effect->forceExtra, trigger_effect->frequency);
			break;
	    case AdaptiveTriggerMode::SEMI_AUTOMATIC:
			TriggerEffectGenerator::Simple_Weapon(rgucTriggerEffect, 0, trigger_effect->start, trigger_effect->end, trigger_effect->force);
			break;
		case AdaptiveTriggerMode::AUTOMATIC:
			TriggerEffectGenerator::Simple_Vibration(rgucTriggerEffect, 0, trigger_effect->start, trigger_effect->force, trigger_effect->frequency);
			break;
		case AdaptiveTriggerMode::MACHINE:
			TriggerEffectGenerator::Machine(rgucTriggerEffect, 0, trigger_effect->start, trigger_effect->end, trigger_effect->force, trigger_effect->forceExtra, trigger_effect->frequency, trigger_effect->frequencyExtra);
			break;
		default:
			rgucTriggerEffect[0] = 0x05; // no effect
		}
	}

public:
	void SendEffect()
	{
		if (_ctrlr_type == JS_TYPE_DS)
		{
			DS5EffectsState_t effectPacket;
			memset(&effectPacket, 0, sizeof(effectPacket));

			// Add adaptive trigger data
			effectPacket.ucEnableBits1 |= 0x08 | 0x04; // Enable left and right trigger effect respectively
			LoadTriggerEffect(effectPacket.rgucLeftTriggerEffect, &_leftTriggerEffect);
			LoadTriggerEffect(effectPacket.rgucRightTriggerEffect, &_rightTriggerEffect);

			// Add current rumbling data
			effectPacket.ucEnableBits1 |= 0x01 | 0x02;
			effectPacket.ucRumbleLeft = _big_rumble >> 8;
			effectPacket.ucRumbleRight = _small_rumble >> 8;

			// Add current mic light
			effectPacket.ucEnableBits2 |= 0x01;      /* Enable microphone light */
			effectPacket.ucMicLightMode = _micLight; /* Bitmask, 0x00 = off, 0x01 = solid, 0x02 = pulse */

			// Send to controller
			SDL_SendGamepadEffect(_sdlController, &effectPacket, sizeof(effectPacket));
		}
	}

	bool _has_gyro;
	bool _has_accel;
	int _split_type = JS_SPLIT_TYPE_FULL;
	int _ctrlr_type = JS_TYPE_UNKNOWN;
	int _vendorId = JS_VENDOR_UNKNOWN;
	int _productId = JS_PRODUCT_UNKNOWN;
	SDL_GUID _guid;
	uint16_t _small_rumble = 0;
	uint16_t _big_rumble = 0;
	AdaptiveTriggerSetting _leftTriggerEffect;
	AdaptiveTriggerSetting _rightTriggerEffect;
	uint8_t _micLight = 0;
	SDL_Gamepad *_sdlController = nullptr;
	bool _has_trackpads;
	trackpad_state_t _trackpads_state[2];
	trackpad_state_t _prev_trackpads_state[2];
};

struct SdlInstance : public JslWrapper
{
private:
#ifdef _WIN32
	// Make Windows 11 honor timer resolution when window is minimized or
	// another application is fullscreen. EcoQoS is also disabled.
	// https://learn.microsoft.com/en-us/windows/win32/api/timeapi/nf-timeapi-timebeginperiod
	// https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessinformation
	void DisableProcessPowerThrottling()
	{
		PROCESS_POWER_THROTTLING_STATE state;
		memset(&state, 0, sizeof(state));
		state.Version = PROCESS_POWER_THROTTLING_CURRENT_VERSION;
		state.ControlMask = PROCESS_POWER_THROTTLING_EXECUTION_SPEED
		                    | PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION;
		state.StateMask = 0;
		SetProcessInformation(GetCurrentProcess(), ProcessPowerThrottling,
		                      &state, sizeof(state));
	}

	// Raise process priority, but not too high.
	// https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities
	void RaiseProcessPriority()
	{
		SetPriorityClass(GetCurrentProcess(), ABOVE_NORMAL_PRIORITY_CLASS);
	}

	// Raise thread priority, but not too high.
	// https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities
	void RaiseThreadPriority()
	{
		SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_HIGHEST);
	}

	typedef long NTSTATUS;
	typedef NTSTATUS (NTAPI *PZEQTR)(PULONG MinRes, PULONG MaxRes, PULONG CurrentRes);
	typedef NTSTATUS (NTAPI *PZESTR)(ULONG DesiredRes, BOOLEAN SetRes, PULONG CurrentRes);
	PZEQTR ZwQueryTimerResolution = nullptr;
	PZESTR ZwSetTimerResolution = nullptr;
	ULONG win_timer_res = 0;
	uint64_t timer_res_ns = 0;

	// Reduce system clock interrupt interval to 0.5 ms. Windows default is
	// 15.625 ms (1000/64). SDL default is 1 ms but it uses timeBeginPeriod.
	void SetMaxTimerResolution()
	{
		ZwQueryTimerResolution = (PZEQTR)GetProcAddress(
		    GetModuleHandle(TEXT("ntdll.dll")), "ZwQueryTimerResolution");
		ZwSetTimerResolution = (PZESTR)GetProcAddress(
		    GetModuleHandle(TEXT("ntdll.dll")), "ZwSetTimerResolution");
		ULONG min_res = 0, max_res = 0, cur_res = 0;
		bool result = false;

		if (ZwQueryTimerResolution != nullptr
		    && ZwQueryTimerResolution(&min_res, &max_res, &cur_res) == 0)
		{
			if (ZwSetTimerResolution != nullptr
			    && ZwSetTimerResolution(max_res, TRUE, &cur_res) == 0)
			{
				win_timer_res = cur_res;
				timer_res_ns = win_timer_res * 100; // 100-ns to ns.
				result = true;
			}
		}

		if (!result)
		{
			// Don't call again.
			ZwQueryTimerResolution = nullptr;
			ZwSetTimerResolution = nullptr;

			// Use safe defaults.
			win_timer_res = 10000;  // 1 ms in 100-ns units.
			timer_res_ns = 1000000; // 1 ms.
		}
	}

	// Call before using a waitable timer to ensure resolution is still correct.
	void ReapplyMaxTimerRes()
	{
		if (ZwSetTimerResolution != nullptr)
		{
			ULONG cur_res = 0;
			ZwSetTimerResolution(win_timer_res, TRUE, &cur_res);
		}
	}

	uint64_t next_poll_time = 0;

	void InitPollingTimer()
	{
		next_poll_time = SDL_GetTicksNS();
	}

	void PollingTimer(uint64_t interval_ms)
	{
		const uint64_t interval_ns = interval_ms * 1000000ULL;
		next_poll_time += interval_ns;

		uint64_t now = SDL_GetTicksNS();
		if (now < next_poll_time)
		{
			// Sleep when delay is longer than timer resolution.
			const uint64_t delay_thresh_ns = now + timer_res_ns;
			if (delay_thresh_ns < next_poll_time)
			{
				// Leave a gap equal to the timer resolution.
				const uint64_t delay_ns = next_poll_time - delay_thresh_ns;
				ReapplyMaxTimerRes();
				SDL_DelayNS(delay_ns);
				now = SDL_GetTicksNS();
			}

			// Busy-wait for the remaining time.
			while (now < next_poll_time)
			{
				SDL_CPUPauseInstruction();
				now = SDL_GetTicksNS();
			}
		}
		else
		{
			// Fell behind.
			next_poll_time = now;
		}
	}
#else
	void DisableProcessPowerThrottling()
	{
	}

	void RaiseProcessPriority()
	{
	}

	void RaiseThreadPriority()
	{
	}

	void SetMaxTimerResolution()
	{
	}

	void InitPollingTimer()
	{
	}

	void PollingTimer(uint64_t interval_ms)
	{
		SDL_DelayNS(interval_ms * 1000000ULL);
	}
#endif // _WIN32

public:
	SdlInstance()
	{
		SDL_SetHint(SDL_HINT_JOYSTICK_ALLOW_BACKGROUND_EVENTS, "1");
		SDL_SetHint(SDL_HINT_JOYSTICK_HIDAPI_JOY_CONS, "1");
		SDL_SetHint(SDL_HINT_JOYSTICK_HIDAPI_XBOX, "1");
		SDL_SetHint(SDL_HINT_JOYSTICK_HIDAPI_PS3, "1");
		SDL_SetHint(SDL_HINT_JOYSTICK_HIDAPI_PS4, "1");
		SDL_SetHint(SDL_HINT_JOYSTICK_HIDAPI_PS5, "1");
		SDL_SetHint(SDL_HINT_JOYSTICK_HIDAPI_GAMECUBE, "1");
		SDL_SetHint(SDL_HINT_JOYSTICK_HIDAPI_COMBINE_JOY_CONS, "0");
		SDL_SetHint(SDL_HINT_JOYSTICK_HIDAPI_VERTICAL_JOY_CONS, "1");
		SDL_SetHint(SDL_HINT_JOYSTICK_HIDAPI_JOYCON_HOME_LED, "0");
		SDL_SetHint(SDL_HINT_JOYSTICK_HIDAPI_SWITCH_HOME_LED, "0");
		SDL_SetHint(SDL_HINT_JOYSTICK_ENHANCED_REPORTS, "1");
		SDL_SetHint(SDL_HINT_JOYSTICK_THREAD, "1");
		SDL_SetHintWithPriority(SDL_HINT_TIMER_RESOLUTION, "1", SDL_HINT_OVERRIDE);
		SDL_Init(SDL_INIT_GAMEPAD);
		SetMaxTimerResolution();
	}

	virtual ~SdlInstance()
	{
		SDL_Quit();
	}

	int pollDevices()
	{
		RaiseThreadPriority();
		InitPollingTimer();

		while (keep_polling)
		{
			auto tick_time = SettingsManager::get<float>(SettingID::TICK_TIME)->value();
			PollingTimer(uint64_t(tick_time));

			lock_guard guard(controller_lock);
			SDL_UpdateGamepads();
			for (auto iter = _controllerMap.begin(); iter != _controllerMap.end(); ++iter)
			{
				if (g_callback)
				{
					JOY_SHOCK_STATE dummy1;
					IMU_STATE dummy2;
					memset(&dummy1, 0, sizeof(dummy1));
					memset(&dummy2, 0, sizeof(dummy2));
					g_callback(iter->first, dummy1, dummy1, dummy2, dummy2, tick_time);
				}
				if (g_trackpad_callback && iter->second->_has_trackpads)
				{
					GetTrackpadState(iter->first, iter->second->_trackpads_state);
					g_trackpad_callback(iter->first, iter->second->_trackpads_state, iter->second->_prev_trackpads_state, tick_time);
					memcpy(iter->second->_prev_trackpads_state, iter->second->_trackpads_state, sizeof(iter->second->_prev_trackpads_state));
				}
				// Perform rumble
				SDL_RumbleGamepad(iter->second->_sdlController, iter->second->_big_rumble, iter->second->_small_rumble, Uint32(tick_time + 5));
			}
		}

		return 1;
	}

	SDL_JoystickID * _joysticksArray = nullptr;
	map<int, ControllerDevice *> _controllerMap;
	void (*g_callback)(int, JOY_SHOCK_STATE, JOY_SHOCK_STATE, IMU_STATE, IMU_STATE, float) = nullptr;
	void (*g_trackpad_callback)(int, const trackpad_state_t *, const trackpad_state_t *, float) = nullptr;
	atomic_bool keep_polling = false;
	mutex controller_lock;

	int ConnectDevices() override
	{
		DisableProcessPowerThrottling();
		RaiseProcessPriority();

		bool isFalse = false;
		if (keep_polling.compare_exchange_strong(isFalse, true))
		{
			// keep polling was false! It is set to true now.
			SDL_Thread* controller_polling_thread = SDL_CreateThread([] (void *obj)
			{
				  auto this_ = static_cast<SdlInstance *>(obj);
				  return this_->pollDevices();
			  },
			  "Poll Devices", this);
			SDL_DetachThread(controller_polling_thread);
		}
		SDL_UpdateGamepads(); // Refresh driver listing
		SDL_free(_joysticksArray);
		int count = 0;
		_joysticksArray = SDL_GetJoysticks(&count);

		// Filter out JSM's own virtual controllers to prevent reconnection loops
		// We filter by VID/PID because the kernel overrides our device name
		int realCount = 0;
		for (int i = 0; i < count; i++)
		{
			uint16_t vid = SDL_GetJoystickVendorForID(_joysticksArray[i]);
			uint16_t pid = SDL_GetJoystickProductForID(_joysticksArray[i]);

			// Skip JSM Virtual Controllers (VID 0x1209 = pid.codes for open source)
			// PID 0x4a53 = "JS" (JSM Xbox), PID 0x4a54 = "JT" (JSM DS4)
			bool isVirtualController = (vid == 0x1209 && (pid == 0x4a53 || pid == 0x4a54));

			if (!isVirtualController)
			{
				realCount++;
			}
		}

		return realCount;
	}

	int GetDeviceCount() override
	{
		std::lock_guard guard(controller_lock);
		SDL_free(_joysticksArray);
		int count = 0;
		_joysticksArray = SDL_GetJoysticks(&count);
		return count;
	}

	int GetConnectedDeviceHandles(int *deviceHandleArray, int size) override
	{
		lock_guard guard(controller_lock);
		auto iter = _controllerMap.begin();
		while (iter != _controllerMap.end())
		{
			delete iter->second;
			iter = _controllerMap.erase(iter);
		}

		int deviceIndex = 0;
		for (int i = 0; i < size && deviceIndex < size; i++)
		{
			// Skip JSM's own virtual controllers by VID/PID
			uint16_t vid = SDL_GetJoystickVendorForID(_joysticksArray[i]);
			uint16_t pid = SDL_GetJoystickProductForID(_joysticksArray[i]);

			// Skip JSM Virtual Controllers (VID 0x1209 = pid.codes for open source)
			// PID 0x4a53 = "JS" (JSM Xbox), PID 0x4a54 = "JT" (JSM DS4)
			bool isVirtualController = (vid == 0x1209 && (pid == 0x4a53 || pid == 0x4a54));

			if (isVirtualController)
			{
				continue;
			}

			ControllerDevice *device = new ControllerDevice(_joysticksArray[i]);
			if (device->isValid())
			{
				deviceHandleArray[deviceIndex] = deviceIndex + 1;
				_controllerMap[deviceHandleArray[deviceIndex]] = device;
				deviceIndex++;
			}
			else
			{
                deviceHandleArray[i] = -1;
				delete device;
			}
		}

		// Fill remaining slots with -1
		for (int i = deviceIndex; i < size; i++)
		{
			deviceHandleArray[i] = -1;
		}

		return int(_controllerMap.size());
	}

	void DisconnectAndDisposeAll() override
	{
		lock_guard guard(controller_lock);
		keep_polling = false;
		g_callback = nullptr;
		g_trackpad_callback = nullptr;
		auto iter = _controllerMap.begin();
		while (iter != _controllerMap.end())
		{
			delete iter->second;
			iter = _controllerMap.erase(iter);
		}
		SDL_free(_joysticksArray);
		_joysticksArray = nullptr;
		SDL_Delay(200);
	}

	JOY_SHOCK_STATE GetSimpleState(int deviceId) override
	{
		return JOY_SHOCK_STATE();
	}

	IMU_STATE GetIMUState(int deviceId) override
	{
		IMU_STATE imuState;
		memset(&imuState, 0, sizeof(imuState));
		if (_controllerMap[deviceId]->_has_gyro)
		{
			array<float, 3> gyro;
			SDL_GetGamepadSensorData(_controllerMap[deviceId]->_sdlController, SDL_SENSOR_GYRO, &gyro[0], 3);
			static constexpr float toDegPerSec = float(180. / M_PI);
			imuState.gyroX = gyro[0] * toDegPerSec;
			imuState.gyroY = gyro[1] * toDegPerSec;
			imuState.gyroZ = gyro[2] * toDegPerSec;
		}
		if (_controllerMap[deviceId]->_has_accel)
		{
			array<float, 3> accel;
			SDL_GetGamepadSensorData(_controllerMap[deviceId]->_sdlController, SDL_SENSOR_ACCEL, &accel[0], 3);
			static constexpr float toGs = 1.f / SDL_STANDARD_GRAVITY;
			imuState.accelX = accel[0] * toGs;
			imuState.accelY = accel[1] * toGs;
			imuState.accelZ = accel[2] * toGs;
		}
		return imuState;
	}

	MOTION_STATE GetMotionState(int deviceId) override
	{
		return MOTION_STATE();
	}

	TOUCH_STATE GetTouchState(int deviceId, bool previous) override
	{
		// Only used by JSL.
		TOUCH_STATE state;
		memset(&state, 0, sizeof(state));
		return state;
	}

	void GetTrackpadState(int deviceId, trackpad_state_t *trackpads_state) override
	{
		for (int i = 0; i < 2; i++)
		{
			trackpad_state_t *trackpad = &trackpads_state[i];
			if (trackpad->enabled)
			{
				for (int j = 0; j < 2; j++)
				{
					finger_state_t *finger = &trackpad->fingers[j];
					if (finger->enabled)
					{
						SDL_GetGamepadTouchpadFinger(_controllerMap[deviceId]->_sdlController, i, j, &finger->down, &finger->x, &finger->y, nullptr);
					}
				}
			}
		}
	}

	bool GetTouchpadDimension(int deviceId, int &sizeX, int &sizeY) override
	{
		// I am assuming a single touchpad (or all _touchpads are the same dimension)?
		auto *jc = _controllerMap[deviceId];
		if (jc != nullptr)
		{
			switch (_controllerMap[deviceId]->_ctrlr_type)
			{
			case JS_TYPE_DS4:
				// Matching SDL resolution
				sizeX = 1920;
				sizeY = 920;
				break;
			case JS_TYPE_DS:
				// Matching SDL resolution
				sizeX = 1920;
				sizeY = 1070;
				break;
			case JS_TYPE_STEAM_CONTROLLER:
				// Steam Controller (2015) has dual 40 mm trackpads, but the
				// actual sensor diameter is 38 mm (see GlidePoint TM040040):
				// https://www.cirque.com/glidepoint-circle-trackpads
				// Scale the input to match a typical mouse:
				// 800 counts/inch * 1 inch / 25.4 mm * 38 mm = 1196.9 counts
				sizeX = 1197;
				sizeY = 1197;
				break;
			case JS_TYPE_STEAM_DECK:
				// Steam Deck has dual 32.5 mm trackpads.
				// Scale the input to match a typical mouse:
				// 800 counts/inch * 1 inch / 25.4 mm * 32.5 mm = 1023.6 counts
				sizeX = 1024;
				sizeY = 1024;
				break;
			case JS_TYPE_STEAM_CONTROLLER_TRITON:
				// Steam Controller has dual 34.5 mm trackpads.
				// Scale the input to match a typical mouse:
				// 800 counts/inch * 1 inch / 25.4 mm * 34.5 mm = 1086.6 counts
				sizeX = 1087;
				sizeY = 1087;
				break;
			default:
				sizeX = 0;
				sizeY = 0;
				break;
			}
			return true;
		}
		return false;
	}

	uint64_t GetButtons(int deviceId) override
	{
		static const map<int, uint64_t> sdl2jsl = {
			{ SDL_GAMEPAD_BUTTON_SOUTH, JSOFFSET_S },
			{ SDL_GAMEPAD_BUTTON_EAST, JSOFFSET_E },
			{ SDL_GAMEPAD_BUTTON_WEST, JSOFFSET_W },
			{ SDL_GAMEPAD_BUTTON_NORTH, JSOFFSET_N },
			{ SDL_GAMEPAD_BUTTON_BACK, JSOFFSET_MINUS },
			{ SDL_GAMEPAD_BUTTON_GUIDE, JSOFFSET_HOME },
			{ SDL_GAMEPAD_BUTTON_START, JSOFFSET_PLUS },
			{ SDL_GAMEPAD_BUTTON_LEFT_STICK, JSOFFSET_LCLICK },
			{ SDL_GAMEPAD_BUTTON_RIGHT_STICK, JSOFFSET_RCLICK },
			{ SDL_GAMEPAD_BUTTON_LEFT_SHOULDER, JSOFFSET_L },
			{ SDL_GAMEPAD_BUTTON_RIGHT_SHOULDER, JSOFFSET_R },
			{ SDL_GAMEPAD_BUTTON_DPAD_UP, JSOFFSET_UP },
			{ SDL_GAMEPAD_BUTTON_DPAD_DOWN, JSOFFSET_DOWN },
			{ SDL_GAMEPAD_BUTTON_DPAD_LEFT, JSOFFSET_LEFT },
			{ SDL_GAMEPAD_BUTTON_DPAD_RIGHT, JSOFFSET_RIGHT }
		};

		uint64_t buttons = 0;
		for (auto pair : sdl2jsl)
		{
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GamepadButton(pair.first)) ? 1ULL << pair.second : 0;

		}
		switch (_controllerMap[deviceId]->_ctrlr_type)
		{
		case JS_TYPE_JOYCON_LEFT:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC1) ? 1ULL << JSOFFSET_CAPTURE : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE2) ? 1ULL << JSOFFSET_SR : 0;
			break;
		case JS_TYPE_JOYCON_RIGHT:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE2) ? 1ULL << JSOFFSET_SL : 0;
			break;
		case JS_TYPE_PRO_CONTROLLER:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC1) ? 1ULL << JSOFFSET_CAPTURE : 0;
			break;
		case JS_TYPE_SWITCH2_PRO_CONTROLLER:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC1) ? 1ULL << JSOFFSET_CAPTURE : 0;    // Capture button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0; // GR back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;  // GL back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC2) ? 1ULL << JSOFFSET_MISC1 : 0;      // C button
			break;
		case JS_TYPE_DS:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC1) ? 1ULL << JSOFFSET_MIC : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_TOUCHPAD) ? 1ULL << JSOFFSET_CAPTURE : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE2) ? 1ULL << JSOFFSET_FNR : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE2) ? 1ULL << JSOFFSET_FNL : 0;
			break;
		case JS_TYPE_DS4:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_TOUCHPAD) ? 1ULL << JSOFFSET_CAPTURE : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE2) ? 1ULL << JSOFFSET_SR : 0;
			break;
		case JS_TYPE_HORI_STEAM:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC1) ? 1ULL << JSOFFSET_MISC1 : 0;            // QAM button ("..." button)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0;       // R4 back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;        // L4 back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE2) ? 1ULL << JSOFFSET_FNR : 0;      // M2 button below right stick
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE2) ? 1ULL << JSOFFSET_FNL : 0;       // M1 button below left stick
			buttons |= SDL_GetGamepadCapSense(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_CAPSENSE_LEFT_STICK) ? 1ULL << JSOFFSET_LTOUCH : 0;  // Left stick capacitive touch
			buttons |= SDL_GetGamepadCapSense(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_CAPSENSE_RIGHT_STICK) ? 1ULL << JSOFFSET_RTOUCH : 0; // Right stick capacitive touch
			break;
		case JS_TYPE_G7_PRO_8K:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC1) ? 1ULL << JSOFFSET_CAPTURE : 0;     // Share button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0;  // R4 back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;   // L4 back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC2) ? 1ULL << JSOFFSET_LMINI : 0;       // L5 mini shoulder button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC3) ? 1ULL << JSOFFSET_RMINI : 0;       // R5 mini shoulder button
			break;
		// 8BitDo controllers with gyro and no additional buttons.
		case JS_TYPE_8BITDO_SF30_PRO:
		case JS_TYPE_8BITDO_SF30_PRO_BT:
		case JS_TYPE_8BITDO_SN30_PRO:
		case JS_TYPE_8BITDO_SN30_PRO_BT:
			break;
		// 8BitDo controllers with gyro and two additional buttons.
		case JS_TYPE_8BITDO_PRO_2:
		case JS_TYPE_8BITDO_PRO_2_BT:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0; // P1 back button (right)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;  // P2 back button (left)
			break;
		// 8BitDo controllers with gyro and four additional buttons.
		case JS_TYPE_8BITDO_PRO_3:
		case JS_TYPE_8BITDO_ULTIMATE2_WIRELESS:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_RMINI : 0; // R4 mini shoulder button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_LMINI : 0;  // L4 mini shoulder button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE2) ? 1ULL << JSOFFSET_SR : 0;    // PR back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE2) ? 1ULL << JSOFFSET_SL : 0;     // PL back button
			break;
		case JS_TYPE_FLYDIGI_APEX5:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0;  // M1 back button (top right)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;   // M2 back button (top left)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE2) ? 1ULL << JSOFFSET_FNR : 0; // M3 back button (bottom right)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE2) ? 1ULL << JSOFFSET_FNL : 0;  // M4 back button (bottom left)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC2) ? 1ULL << JSOFFSET_LMINI : 0;       // LM mini shoulder button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC3) ? 1ULL << JSOFFSET_RMINI : 0;       // RM mini shoulder button
			break;
		case JS_TYPE_FLYDIGI_VADER5_PRO:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC4) ? 1ULL << JSOFFSET_LMINI : 0;       // LM mini shoulder button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC5) ? 1ULL << JSOFFSET_RMINI : 0;       // RM mini shoulder button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC6) ? 1ULL << JSOFFSET_MISC3 : 0;       // Circle button below right stick
			// Fall through.
		case JS_TYPE_FLYDIGI_VADER4_PRO:
		case JS_TYPE_FLYDIGI_VADER3_PRO:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0;  // M1 back button (top right)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;   // M2 back button (top left)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE2) ? 1ULL << JSOFFSET_FNR : 0; // M3 back button (bottom right)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE2) ? 1ULL << JSOFFSET_FNL : 0;  // M4 back button (bottom left)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC2) ? 1ULL << JSOFFSET_MISC1 : 0;       // C face button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC3) ? 1ULL << JSOFFSET_MISC2 : 0;       // Z face button
			break;
		case JS_TYPE_STEAM_CONTROLLER:
			// Only the back grip buttons are exposed by SDL3.
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0;   // Right back grip button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;    // Left back grip button
			// SDL3 doesn't expose trackpad clicks, so find them indirectly.
			{
				float pressure = 0.0f;
				if (SDL_GetGamepadTouchpadFinger(_controllerMap[deviceId]->_sdlController, 0, 0, nullptr, nullptr, nullptr, &pressure) && pressure > 0.9f)
				{
					buttons |= 1ULL << JSOFFSET_LTP_CAPTURE; // Left trackpad click
				}
				if (SDL_GetGamepadTouchpadFinger(_controllerMap[deviceId]->_sdlController, 1, 0, nullptr, nullptr, nullptr, &pressure) && pressure > 0.9f)
				{
					buttons |= 1ULL << JSOFFSET_RTP_CAPTURE; // Right trackpad click
				}
			}
			break;
		case JS_TYPE_STEAM_CONTROLLER_TRITON:
			buttons |= SDL_GetGamepadCapSense(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_CAPSENSE_LEFT_GRIP) ? 1ULL << JSOFFSET_LGRIP : 0;    // Left grip sense
			buttons |= SDL_GetGamepadCapSense(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_CAPSENSE_RIGHT_GRIP) ? 1ULL << JSOFFSET_RGRIP : 0;   // Right grip sense
			// Fall through.
		case JS_TYPE_STEAM_DECK:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC1) ? 1ULL << JSOFFSET_MISC1 : 0;              // QAM button ("..." button)
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0;         // R4 back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;          // L4 back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE2) ? 1ULL << JSOFFSET_FNR : 0;        // R5 back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE2) ? 1ULL << JSOFFSET_FNL : 0;         // L5 back button
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_TOUCHPAD) ? 1ULL << JSOFFSET_LTP_CAPTURE : 0;     // Left trackpad click
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC2) ? 1ULL << JSOFFSET_RTP_CAPTURE : 0;        // Right trackpad click
			buttons |= SDL_GetGamepadCapSense(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_CAPSENSE_LEFT_STICK) ? 1ULL << JSOFFSET_LTOUCH : 0;    // Left stick capacitive touch
			buttons |= SDL_GetGamepadCapSense(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_CAPSENSE_RIGHT_STICK) ? 1ULL << JSOFFSET_RTOUCH : 0;   // Right stick capacitive touch
			break;
		default:
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC1) ? 1ULL << JSOFFSET_MISC1 : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE1) ? 1ULL << JSOFFSET_SR : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE1) ? 1ULL << JSOFFSET_SL : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_RIGHT_PADDLE2) ? 1ULL << JSOFFSET_FNR : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_LEFT_PADDLE2) ? 1ULL << JSOFFSET_FNL : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC2) ? 1ULL << JSOFFSET_MISC2 : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC3) ? 1ULL << JSOFFSET_MISC3 : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC4) ? 1ULL << JSOFFSET_MISC4 : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC5) ? 1ULL << JSOFFSET_MISC5 : 0;
			buttons |= SDL_GetGamepadButton(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_BUTTON_MISC6) ? 1ULL << JSOFFSET_MISC6 : 0;
			break;
		}
		return buttons;
	}

	float GetLeftX(int deviceId) override
	{
		return SDL_GetGamepadAxis(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_AXIS_LEFTX) / (float)SDL_JOYSTICK_AXIS_MAX;
	}

	float GetLeftY(int deviceId) override
	{
		return -SDL_GetGamepadAxis(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_AXIS_LEFTY) / (float)SDL_JOYSTICK_AXIS_MAX;
	}

	float GetRightX(int deviceId) override
	{
		return SDL_GetGamepadAxis(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_AXIS_RIGHTX) / (float)SDL_JOYSTICK_AXIS_MAX;
	}

	float GetRightY(int deviceId) override
	{
		return -SDL_GetGamepadAxis(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_AXIS_RIGHTY) / (float)SDL_JOYSTICK_AXIS_MAX;
	}

	float GetLeftTrigger(int deviceId) override
	{
		return (SDL_GetGamepadAxis(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_AXIS_LEFT_TRIGGER)) / (float)(SDL_JOYSTICK_AXIS_MAX);
	}

	float GetRightTrigger(int deviceId) override
	{
		return (SDL_GetGamepadAxis(_controllerMap[deviceId]->_sdlController, SDL_GAMEPAD_AXIS_RIGHT_TRIGGER)) / (float)(SDL_JOYSTICK_AXIS_MAX);
	}

	float GetGyroX(int deviceId) override
	{
		if (_controllerMap[deviceId]->_has_gyro)
		{
			float rawGyro[3];
			SDL_GetGamepadSensorData(_controllerMap[deviceId]->_sdlController, SDL_SENSOR_GYRO, rawGyro, 3);
		}
		return float();
	}

	float GetGyroY(int deviceId) override
	{
		if (_controllerMap[deviceId]->_has_gyro)
		{
			float rawGyro[3];
			SDL_GetGamepadSensorData(_controllerMap[deviceId]->_sdlController, SDL_SENSOR_GYRO, rawGyro, 3);
		}
		return float();
	}

	float GetGyroZ(int deviceId) override
	{
		if (_controllerMap[deviceId]->_has_gyro)
		{
			float rawGyro[3];
			SDL_GetGamepadSensorData(_controllerMap[deviceId]->_sdlController, SDL_SENSOR_GYRO, rawGyro, 3);
		}
		return float();
	}

	float GetAccelX(int deviceId) override
	{
		return float();
	}

	float GetAccelY(int deviceId) override
	{
		return float();
	}

	float GetAccelZ(int deviceId) override
	{
		return float();
	}

	int GetTouchId(int deviceId, bool secondTouch = false) override
	{
		return int();
	}

	bool GetTouchDown(int deviceId, int touchpad, int finger) override
	{
		bool touchState = false;
		if (SDL_GetGamepadTouchpadFinger(_controllerMap[deviceId]->_sdlController, touchpad, finger, &touchState, nullptr, nullptr, nullptr))
		{
			return touchState;
		}
		return false;
	}

	float GetTouchX(int deviceId, int touchpad, int finger) override
	{
		float x = 0.0f;
		if (SDL_GetGamepadTouchpadFinger(_controllerMap[deviceId]->_sdlController, touchpad, finger, nullptr, nullptr, &x, nullptr))
		{
			return x;
		}
		return 0.0f;
	}

	float GetTouchY(int deviceId, int touchpad, int finger) override
	{
		float y = 0.0f;
		if (SDL_GetGamepadTouchpadFinger(_controllerMap[deviceId]->_sdlController, touchpad, finger, nullptr, nullptr, &y, nullptr))
		{
			return y;
		}
		return 0.0f;
	}

	float GetStickStep(int deviceId) override
	{
		return float();
	}

	float GetTriggerStep(int deviceId) override
	{
		return float();
	}

	float GetPollRate(int deviceId) override
	{
		return float();
	}

	float GetSampleRateHz(int deviceId) override
	{
		return 0.0f;
	}

	float GetTimeSinceLastUpdate(int deviceId) override
	{
		return 0.0f;
	}

	void ResetContinuousCalibration(int deviceId) override
	{
	}

	void StartContinuousCalibration(int deviceId) override
	{
	}

	void PauseContinuousCalibration(int deviceId) override
	{
	}

	void GetCalibrationOffset(int deviceId, float &xOffset, float &yOffset, float &zOffset) override
	{
	}

	void SetCalibrationOffset(int deviceId, float xOffset, float yOffset, float zOffset) override
	{
	}

	void SetCallback(void (*callback)(int, JOY_SHOCK_STATE, JOY_SHOCK_STATE, IMU_STATE, IMU_STATE, float)) override
	{
		lock_guard guard(controller_lock);
		g_callback = callback;
	}

	void SetTouchCallback(void (*callback)(int, TOUCH_STATE, TOUCH_STATE, float)) override
	{
		// Only used by JSL.
	}

	void SetTrackpadCallback(void (*callback)(int, const trackpad_state_t *, const trackpad_state_t *, float)) override
	{
		lock_guard guard(controller_lock);
		g_trackpad_callback = callback;
	}

	int GetControllerType(int deviceId) override
	{
		return _controllerMap[deviceId]->_ctrlr_type;
	}

	int GetControllerSplitType(int deviceId) override
	{
		return _controllerMap[deviceId]->_split_type;
	}

	int GetControllerVendor(int deviceId) override
	{
		return _controllerMap[deviceId]->_vendorId;
	}

	int GetControllerProduct(int deviceId) override
	{
		return _controllerMap[deviceId]->_productId;
	}

	int GetControllerColour(int deviceId) override
	{
		return int();
	}

	void SetLightColour(int deviceId, int colour) override
	{
		auto prop = SDL_GetGamepadProperties(_controllerMap[deviceId]->_sdlController);
		
		if (SDL_GetStringProperty(prop, SDL_PROP_GAMEPAD_CAP_RGB_LED_BOOLEAN, nullptr) != nullptr)
		{
			union
			{
				uint32_t raw;
				uint8_t argb[4];
			} uColour;
			uColour.raw = colour;
			SDL_SetGamepadLED(_controllerMap[deviceId]->_sdlController, uColour.argb[2], uColour.argb[1], uColour.argb[0]);
		}
	}

	void SetRumble(int deviceId, int smallRumble, int bigRumble) override
	{
		// sendRumble command needs to be sent at every poll in SDL, so the next value is set here and the actual call
		// is done after the callback return
		_controllerMap[deviceId]->_small_rumble = clamp(smallRumble, 0, int(UINT16_MAX));
		_controllerMap[deviceId]->_big_rumble = clamp(bigRumble, 0, int(UINT16_MAX));
	}

	void SetPlayerNumber(int deviceId, int number) override
	{
		SDL_SetGamepadPlayerIndex(_controllerMap[deviceId]->_sdlController, number);
	}

	void SetTriggerEffect(int deviceId, const AdaptiveTriggerSetting &_leftTriggerEffect, const AdaptiveTriggerSetting &_rightTriggerEffect) override
	{
		if (_leftTriggerEffect != _controllerMap[deviceId]->_leftTriggerEffect || _rightTriggerEffect != _controllerMap[deviceId]->_rightTriggerEffect)
		{
			// Update active trigger effect
			_controllerMap[deviceId]->_leftTriggerEffect = _leftTriggerEffect;
			_controllerMap[deviceId]->_rightTriggerEffect = _rightTriggerEffect;
		}
		_controllerMap[deviceId]->SendEffect();
	}

	virtual void SetMicLight(int deviceId, uint8_t mode) override
	{
		if (mode != _controllerMap[deviceId]->_micLight)
		{
			_controllerMap[deviceId]->_micLight = mode;

			_controllerMap[deviceId]->SendEffect();
		}
	}
};

JslWrapper *JslWrapper::getNew()
{
	return new SdlInstance();
}
