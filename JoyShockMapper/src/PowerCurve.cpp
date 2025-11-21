#include "PowerCurve.h"
#include <cmath>

float PowerSensitivity(float omega, float scale, float exponent, float offset)
{
    return std::pow(scale * omega, exponent) + offset;
}
