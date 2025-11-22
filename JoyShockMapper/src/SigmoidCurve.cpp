#include "SigmoidCurve.h"
#include <cmath>

float SigmoidSensitivity(float omega,
                         float sMin, float sMax,
                         float vMid, float width)
{
    // Avoid division by zero
    const float w = (width > 0.0f) ? width : 1e-6f;

    // Raw sigmoid
    auto raw = [&](float x) {
        const float z = (x - vMid) / w;
        return 1.0f / (1.0f + std::exp(-z));
    };

    // Raw sigmoid at omega
    const float sigma = raw(omega);

    // Raw sigmoid at zero (left endpoint anchor)
    const float sigma0 = raw(0.0f);

    // Normalize to t ∈ [0,1]
    float t = 0.0f;
    const float denom = 1.0f - sigma0;

    if (denom > 0.0f)
        t = (sigma - sigma0) / denom;

    // Clamp
    if (t < 0.0f) t = 0.0f;
    if (t > 1.0f) t = 1.0f;

    // Final mapping to [sMin, sMax]
    return sMin + (sMax - sMin) * t;
}
