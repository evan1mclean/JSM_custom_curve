#include "NaturalCurve.h"

float NaturalSensitivity(float omega, float sMin, float sMax, float vHalf)
{
    // Avoid division by zero; if vHalf is invalid, fall back to max sensitivity.
    if (vHalf <= 0.0f)
    {
        return sMax;
    }

    const float delta = sMax - sMin;
    const float k = std::log(2.0f) / vHalf;
    const float sens = sMax - delta * std::exp(-k * omega);
    return sens;
}
