#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include <cmath>
#include "JumpCurve.h"   // declares JumpSensitivity

using Catch::Approx;

// Model under test:
//
// float JumpSensitivity(float omega,
//                       float sBase,
//                       float sPeak,
//                       float vJump,
//                       float tau);
//
// Behavior:
//  - If tau <= 0:
//        omega <= vJump -> sBase
//        omega >  vJump -> sPeak
//  - If tau > 0:
//        omega >  vJump -> sPeak (flat plateau)
//        omega <= vJump:
//             z = (omega - vJump) / tau  (<= 0)
//             S = sBase + (sPeak - sBase) * exp(z)
//
// So: flat near sBase at low speeds, smooth rise toward sPeak as we approach vJump
// from the left, then a hard cap at sPeak for all omega > vJump.


// ---------------------------------------------------------
// 1. Basic shape / anchor tests (tau > 0)
// ---------------------------------------------------------

TEST_CASE("JumpSensitivity at very low omega is approximately sBase when tau > 0") {
    float sBase = 1.0f;
    float sPeak = 1.4f;
    float vJump = 50.0f;
    float tau   = 5.0f;

    float S0 = JumpSensitivity(0.0f, sBase, sPeak, vJump, tau);

    // For omega << vJump, exp((omega - vJump)/tau) is tiny,
    // so S ≈ sBase.
    REQUIRE(S0 >= sBase);
    REQUIRE(S0 == Approx(sBase).margin(1e-3f));  // very close
}

TEST_CASE("JumpSensitivity at vJump equals sPeak when tau > 0") {
    float sBase = 1.0f;
    float sPeak = 1.4f;
    float vJump = 50.0f;
    float tau   = 5.0f;

    float S = JumpSensitivity(vJump, sBase, sPeak, vJump, tau);

    // At omega = vJump:
    //   z = 0, exp(0) = 1 -> S = sPeak
    REQUIRE(S == Approx(sPeak).margin(1e-6f));
}

TEST_CASE("JumpSensitivity above vJump is clamped to sPeak when tau > 0") {
    float sBase = 1.0f;
    float sPeak = 1.4f;
    float vJump = 50.0f;
    float tau   = 5.0f;

    for (float omega : { 50.1f, 60.0f, 100.0f }) {
        float S = JumpSensitivity(omega, sBase, sPeak, vJump, tau);
        REQUIRE(S == Approx(sPeak).margin(1e-6f));
    }
}


// ---------------------------------------------------------
// 2. Range and monotonicity tests (tau > 0)
// ---------------------------------------------------------

TEST_CASE("JumpSensitivity with tau > 0 stays within [sBase, sPeak]") {
    float sBase = 1.0f;
    float sPeak = 1.4f;
    float vJump = 50.0f;
    float tau   = 5.0f;

    for (float omega = 0.0f; omega <= 100.0f; omega += 2.0f) {
        float S = JumpSensitivity(omega, sBase, sPeak, vJump, tau);
        REQUIRE(S >= Approx(sBase).margin(1e-6f));
        REQUIRE(S <= Approx(sPeak).margin(1e-6f));
    }
}

TEST_CASE("JumpSensitivity is monotone increasing on [0, vJump] when tau > 0") {
    float sBase = 1.0f;
    float sPeak = 1.4f;
    float vJump = 50.0f;
    float tau   = 5.0f;

    float prev = JumpSensitivity(0.0f, sBase, sPeak, vJump, tau);

    for (float omega = 0.0f; omega <= vJump; omega += 2.0f) {
        float cur = JumpSensitivity(omega, sBase, sPeak, vJump, tau);
        REQUIRE(cur >= Approx(prev).margin(1e-6f));
        prev = cur;
    }
}


// ---------------------------------------------------------
// 3. Parameter behavior tests (tau > 0)
// ---------------------------------------------------------

TEST_CASE("Larger tau raises the pre-jump sensitivity (slower exponential decay)") {
    float sBase = 1.0f;
    float sPeak = 1.4f;
    float vJump = 50.0f;

    float tau_fast = 2.0f;   // sharp, delayed bump
    float tau_slow = 10.0f;  // bump spreads farther left

    float omega = 45.0f;     // below vJump, but not too far

    float s_fast = JumpSensitivity(omega, sBase, sPeak, vJump, tau_fast);
    float s_slow = JumpSensitivity(omega, sBase, sPeak, vJump, tau_slow);

    // With larger tau, exp(z) is larger for the same omega < vJump,
    // so S should be closer to sPeak, i.e. s_slow > s_fast.
    REQUIRE(s_slow >= Approx(s_fast).margin(1e-6f));
    REQUIRE(s_fast >= Approx(sBase).margin(1e-6f));
    REQUIRE(s_slow <= Approx(sPeak).margin(1e-6f));
}


// ---------------------------------------------------------
// 4. Edge cases: tau <= 0 (hard-step mode)
// ---------------------------------------------------------

TEST_CASE("JumpSensitivity with tau <= 0 behaves as hard step at vJump") {
    float sBase = 1.0f;
    float sPeak = 1.4f;
    float vJump = 50.0f;

    for (float tau : {0.0f, -1.0f, -10.0f}) {
        float below = JumpSensitivity(40.0f, sBase, sPeak, vJump, tau);
        float at    = JumpSensitivity(50.0f, sBase, sPeak, vJump, tau);
        float above = JumpSensitivity(60.0f, sBase, sPeak, vJump, tau);

        REQUIRE(below == Approx(sBase).margin(1e-6f));
        REQUIRE(at    == Approx(sBase).margin(1e-6f)); // omega <= vJump branch
        REQUIRE(above == Approx(sPeak).margin(1e-6f));
    }
}


// ---------------------------------------------------------
// 5. Golden sample tests for a specific parameter set (tau > 0)
// ---------------------------------------------------------
//
// Use: sBase=1.0, sPeak=1.4, vJump=50, tau=5
//   Δ = 0.4
//   S(ω) = 1.0 + 0.4 * exp((ω - 50)/5)
//
// Check a few nice-ish points:
//
// ω =  0: z=-10, exp(-10) ≈ 0.0000453999, S ≈ 1.00001816
// ω = 40: z=-2,  exp(-2)  ≈ 0.13533528,  S ≈ 1.05413411
// ω = 45: z=-1,  exp(-1)  ≈ 0.36787944,  S ≈ 1.14715178
// ω = 50: z=0,   exp(0)   = 1.0,         S = 1.4
//
TEST_CASE("JumpSensitivity matches golden samples for sBase=1.0, sPeak=1.4, vJump=50, tau=5") {
    float sBase = 1.0f;
    float sPeak = 1.4f;
    float vJump = 50.0f;
    float tau   = 5.0f;

    REQUIRE(JumpSensitivity( 0.0f, sBase, sPeak, vJump, tau) == Approx(1.000018f ).margin(1e-6f));
    REQUIRE(JumpSensitivity(40.0f, sBase, sPeak, vJump, tau) == Approx(1.054134f ).margin(1e-6f));
    REQUIRE(JumpSensitivity(45.0f, sBase, sPeak, vJump, tau) == Approx(1.147152f ).margin(1e-6f));
    REQUIRE(JumpSensitivity(50.0f, sBase, sPeak, vJump, tau) == Approx(1.4f      ).margin(1e-6f));
}
