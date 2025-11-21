#pragma once

#include "JoyShockMapper.h"
#include "MotionIf.h"
#include "DigitalButton.h"
#include "Stick.h"
#include "JslWrapper.h"
#include "SettingsManager.h"
#include "../src/quatMaths.cpp"

// An instance of this class represents a single controller device that JSM is listening to.
class JoyShock
{
public:
	JoyShock(int uniqueHandle, int controllerSplitType, shared_ptr<DigitalButton::Context> sharedButtonCommon = nullptr);

	~JoyShock();

	// These two large functions are defined further down
	void processStick(float stickX, float stickY, Stick &stick, float mouseCalibrationFactor, float deltaTime, bool &anyStickInput, bool &lockMouse, float &camSpeedX, float &camSpeedY);

	void handleTouchStickChange(TouchStick &ts, bool down, short movX, short movY, float delta_time);

	bool hasVirtualController();

	void onVirtualControllerNotification(uint8_t largeMotor, uint8_t smallMotor, Indicator indicator);

	template<typename E>
	E getSetting(SettingID index);

	float getSetting(SettingID index);

	template<>
	FloatXY getSetting<FloatXY>(SettingID index);

	template<>
	GyroSettings getSetting<GyroSettings>(SettingID index);

	template<>
	Color getSetting<Color>(SettingID index);

	template<>
	AdaptiveTriggerSetting getSetting<AdaptiveTriggerSetting>(SettingID index);

	template<>
	AxisSignPair getSetting<AxisSignPair>(SettingID index);

	void getSmoothedGyro(float x, float y, float length, float bottomThreshold, float topThreshold, int maxSamples, float &outX, float &outY);

	void handleButtonChange(ButtonID id, bool pressed, int touchpadID = -1);

	void handleTriggerChange(ButtonID softIndex, ButtonID fullIndex, TriggerMode mode, float position, AdaptiveTriggerSetting &trigger_rumble);

	bool isPressed(ButtonID btn);

	// return true if it hits the outer deadzone
	bool processDeadZones(float &x, float &y, float innerDeadzone, float outerDeadzone);

	void updateGridSize();

	bool processGyroStick(float stickX, float stickY, float stickLength, StickMode stickMode, bool forceOutput);

	shared_ptr<DigitalButton::Context> _context;
	vector<DigitalButton> _buttons;
	vector<DigitalButton> _gridButtons;
	vector<TouchStick> _touchpads;
	chrono::steady_clock::time_point _timeNow;
	shared_ptr<MotionIf> _motion;
	int _handle;
	int _controllerType;
	int _splitType = 0;
	int _vendorId = 0;
	int _productId = 0;
	bool _ignoreGyro = false;


	float neutralQuatW = 1.0f;
	float neutralQuatX = 0.0f;
	float neutralQuatY = 0.0f;
	float neutralQuatZ = 0.0f;

	bool set_neutral_quat = false;

	Color _light_bar;
	AdaptiveTriggerSetting _leftEffect;
	AdaptiveTriggerSetting _rightEffect;
	static AdaptiveTriggerSetting _unusedEffect;

	Stick _leftStick;
	Stick _rightStick;
	Stick _motionStick;

	bool processed_gyro_stick = false;
	static constexpr int NUM_LAST_GYRO_SAMPLES = 100;
	array<float, NUM_LAST_GYRO_SAMPLES> lastGyroX = { 0.f };
	array<float, NUM_LAST_GYRO_SAMPLES> lastGyroY = { 0.f };
	float lastGyroAbsX = 0.f;
	float lastGyroAbsY = 0.f;
	int lastGyroIndexX = 0;
	int lastGyroIndexY = 0;

	float gyroXVelocity = 0.f;
	float gyroYVelocity = 0.f;

private:
	// this large functions is defined further down
	float handleFlickStick(float stickX, float stickY, Stick &stick, float stickLength, StickMode mode);

	bool isSoftPullPressed(int triggerIndex, float triggerPosition);

	float getTriggerEffectStartPos();

	template<typename E>
	optional<E> getSettingAtChord(SettingID id, ButtonID chord);

	void sendRumble(int smallRumble, int bigRumble);

	DigitalButton *getMatchingSimBtn(ButtonID index);
	DigitalButton *getMatchingDiagBtn(ButtonID index, optional<MapIterator> &iter);

	void resetSmoothSample();

	float getSmoothedStickRotation(float value, float bottomThreshold, float topThreshold, int maxSamples);

	static constexpr int MAX_GYRO_SAMPLES = 256;
	static constexpr int NUM_SAMPLES = 256;

	array<float, NUM_SAMPLES> _flickSamples;
	int _frontSample = 0;

	array<FloatXY, MAX_GYRO_SAMPLES> _gyroSamples;
	int _frontGyroSample = 0;

	Vec _lastGrav = Vec(0.f, -1.f, 0.f);

	float _windingAngleLeft = 0.f;
	float _windingAngleRight = 0.f;

	ScrollAxis _touchScrollX;
	ScrollAxis _touchScrollY;

	vector<DstState> _triggerState; // State of analog triggers when skip mode is active
	vector<deque<float>> _prevTriggerPosition;
};

template<typename E>
optional<E> JoyShock::getSettingAtChord(SettingID id, ButtonID chord)
{
	auto setting = SettingsManager::get<E>(id);
	if (setting)
	{
		auto chordedValue = setting->chordedValue(chord);
		return chordedValue ? optional<E>(setting->chordedValue(chord)) : nullopt;
	}
	return nullopt;
}

template<typename E>
E JoyShock::getSetting(SettingID index)
{
	static_assert(is_enum<E>::value, "Parameter of JoyShock::getSetting<E> has to be an enum type");
	// Look at active chord mappings starting with the latest activates chord
	for (auto activeChord = _context->chordStack.begin(); activeChord != _context->chordStack.end(); activeChord++)
	{
		optional<E> opt = getSettingAtChord<E>(index, *activeChord);
		if constexpr (is_same_v<E, StickMode>)
		{
			switch (index)
			{
			case SettingID::LEFT_STICK_MODE:
				if (_leftStick.flick_percent_done < 1.f && opt && (*opt != StickMode::FLICK && *opt != StickMode::FLICK_ONLY))
					opt = make_optional(StickMode::FLICK_ONLY);
				else if (_leftStick.ignore_stick_mode && *activeChord == ButtonID::NONE)
					opt = StickMode::INVALID;
				else
					_leftStick.ignore_stick_mode |= (opt && *activeChord != ButtonID::NONE);
				break;
			case SettingID::RIGHT_STICK_MODE:
				if (_rightStick.flick_percent_done < 1.f && opt && (*opt != StickMode::FLICK && *opt != StickMode::FLICK_ONLY))
					opt = make_optional(StickMode::FLICK_ONLY);
				else if (_rightStick.ignore_stick_mode && *activeChord == ButtonID::NONE)
					opt = make_optional(StickMode::INVALID);
				else
					_rightStick.ignore_stick_mode |= (opt && *activeChord != ButtonID::NONE);
				break;
			case SettingID::MOTION_STICK_MODE:
				if (_motionStick.flick_percent_done < 1.f && opt && (*opt != StickMode::FLICK && *opt != StickMode::FLICK_ONLY))
					opt = make_optional(StickMode::FLICK_ONLY);
				else if (_motionStick.ignore_stick_mode && *activeChord == ButtonID::NONE)
					opt = make_optional(StickMode::INVALID);
				else
					_motionStick.ignore_stick_mode |= (opt && *activeChord != ButtonID::NONE);
				break;
			}
		}

		if constexpr (is_same_v<E, ControllerOrientation>)
		{
			if (index == SettingID::CONTROLLER_ORIENTATION && opt &&
			  opt.value() == ControllerOrientation::JOYCON_SIDEWAYS)
			{
				if (_splitType == JS_SPLIT_TYPE_LEFT)
				{
					opt = optional<E>(static_cast<E>(ControllerOrientation::LEFT));
				}
				else if (_splitType == JS_SPLIT_TYPE_RIGHT)
				{
					opt = optional<E>(static_cast<E>(ControllerOrientation::RIGHT));
				}
				else
				{
					opt = optional<E>(static_cast<E>(ControllerOrientation::FORWARD));
				}
			}
		}
		if (opt)
			return *opt;
	}
	stringstream ss;
	ss << "Index " << index << " is not a valid enum setting";
	throw invalid_argument(ss.str().c_str());
}
