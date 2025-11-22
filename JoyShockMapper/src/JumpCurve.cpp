#include "JumpCurve.h"
#include <cmath>

float JumpSensitivity(float omega,
                      float sBase, float sPeak,
                      float vJump, float tau)
{
    // Handle degenerate tau: make an instant jump at vJump.
    if (tau <= 0.0f)
    {
        return (omega < vJump) ? sBase : sPeak;
    }

    // --- 1. Raw jump core (matches the canvas model) ---
    auto raw = [&](float x) -> float
    {
        if (x >= vJump)
            return 1.0f;

        const float z = (x - vJump) / tau;
        return std::exp(z);   // rises smoothly to 1.0 at x = vJump
    };

    // --- 2. Compute raw(0) and normalize into t ∈ [0, 1] ---
    const float raw0  = raw(0.0f);
    const float denom = 1.0f - raw0;

    float r = raw(omega);
    float t = 0.0f;

    if (denom > 0.0f)
        t = (r - raw0) / denom;

    // Clamp t to [0,1]
    if (t < 0.0f) t = 0.0f;
    if (t > 1.0f) t = 1.0f;

    // --- 3. Final mapping to sensitivity range ---
    return sBase + (sPeak - sBase) * t;
}
