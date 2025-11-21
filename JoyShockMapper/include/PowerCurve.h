#pragma once

// Computes the "power" acceleration sensitivity curve.
// omega: input speed (deg/sec or equivalent)
// scale: multiplier applied to omega before exponentiation
// exponent: power applied to the scaled input
// offset: value added after the power term
float PowerSensitivity(float omega, float scale, float exponent, float offset);
