#include "JumpCurve.h"
#include <cmath>

float JumpSensitivity(float omega, float sBase, float sPeak, float vJump, float tau)
{
    // Degenerate tau: immediate jump at vJump.
    if (tau <= 0.0f)
    {
        return (omega <= vJump) ? sBase : sPeak;
    }

    if (omega > vJump)
    {
        return sPeak;
    }

    const float z = (omega - vJump) / tau;
    return sBase + (sPeak - sBase) * std::exp(z);
}
