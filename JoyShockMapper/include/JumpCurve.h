#pragma once

// Jump curve:
// For omega <= vJump:
//   S = sBase + (sPeak - sBase) * exp((omega - vJump) / tau)
// For omega > vJump:
//   S = sPeak
// If tau <= 0, treat it as an immediate jump: sBase before the jump, sPeak at/after.
float JumpSensitivity(float omega, float sBase, float sPeak, float vJump, float tau);
