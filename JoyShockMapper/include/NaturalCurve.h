#pragma once

#include <cmath>

// Computes the "natural" acceleration sensitivity curve.
// omega: angular velocity (deg/sec)
// sMin: minimum sensitivity
// sMax: maximum sensitivity
// vHalf: velocity at which sensitivity is halfway between sMin and sMax
float NaturalSensitivity(float omega, float sMin, float sMax, float vHalf);
