#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include <cmath>
#include "JumpCurve.h"

using Catch::Approx;

// Signature:
//
// float JumpSensitivity(float omega,
//                       float sBase, float sPeak,
//                       float vJump, float tau);
//
// Model (normalized):
//   raw(ω) = exp((ω - vJump)/tau) for ω < vJump
//            1                    for ω >= vJump
//   raw0   = raw(0)
//   t(ω)   = (raw(ω) - raw0) / (1 - raw0)
//   S(ω)   = sBase + (sPeak - sBase) * clamp(t, 0, 1)
//
// Ensures S(0) = sBase, S(vJump) = sPeak, monotone from base to peak.


// ---------------------------------------------------------
// 1. Basic anchors
// ---------------------------------------------------------

TEST_CASE("JumpSensitivity at omega = 0 returns sBase") {
    float sBase = 1.0f;
    float sPeak = 2.0f;
    float vJump = 80.0f;
    float tau   = 20.0f;

    float S = JumpSensitivity(0.0f, sBase, sPeak, vJump, tau);
    REQUIRE(S == Approx(sBase).margin(1e-6f));
}

TEST_CASE("JumpSensitivity reaches sPeak at and beyond vJump") {
    float sBase = 1.0f;
    float sPeak = 2.0f;
    float vJump = 80.0f;
    float tau   = 20.0f;

    float S_at_jump   = JumpSensitivity(vJump,     sBase, sPeak, vJump, tau);
    float S_beyond    = JumpSensitivity(vJump+50,  sBase, sPeak, vJump, tau);
    float S_far_beyond= JumpSensitivity(1e6f,      sBase, sPeak, vJump, tau);

    REQUIRE(S_at_jump   == Approx(sPeak).margin(1e-4f));
    REQUIRE(S_beyond    == Approx(sPeak).margin(1e-4f));
    REQUIRE(S_far_beyond== Approx(sPeak).margin(1e-3f));
}


// ---------------------------------------------------------
// 2. Range and monotonicity
// ---------------------------------------------------------

TEST_CASE("JumpSensitivity stays within [sBase, sPeak]") {
    float sBase = 1.0f;
    float sPeak = 2.0f;
    float vJump = 80.0f;
    float tau   = 20.0f;

    for (float omega = 0.0f; omega <= 200.0f; omega += 2.0f) {
        float S = JumpSensitivity(omega, sBase, sPeak, vJump, tau);
        REQUIRE(S >= Approx(sBase).margin(1e-6f));
        REQUIRE(S <= Approx(sPeak).margin(1e-6f));
    }
}

TEST_CASE("JumpSensitivity is monotone non-decreasing in omega") {
    float sBase = 1.0f;
    float sPeak = 2.0f;
    float vJump = 80.0f;
    float tau   = 20.0f;

    float prev = JumpSensitivity(0.0f, sBase, sPeak, vJump, tau);

    for (float omega = 0.0f; omega <= 200.0f; omega += 2.0f) {
        float cur = JumpSensitivity(omega, sBase, sPeak, vJump, tau);
        REQUIRE(cur >= Approx(prev).margin(1e-6f));
        prev = cur;
    }
}


// ---------------------------------------------------------
// 3. Parameter behavior
// ---------------------------------------------------------

TEST_CASE("Increasing vJump delays the jump region") {
    float sBase = 1.0f;
    float sPeak = 2.0f;
    float tau   = 20.0f;

    float vJump_early = 60.0f;
    float vJump_late  = 120.0f;

    float omega = 80.0f; // between the two jump speeds

    float S_early = JumpSensitivity(omega, sBase, sPeak, vJump_early, tau);
    float S_late  = JumpSensitivity(omega, sBase, sPeak, vJump_late,  tau);

    // Earlier jump => more progression toward sPeak at this omega
    REQUIRE(S_early >= Approx(S_late).margin(1e-6f));
}

TEST_CASE("Smaller tau makes the ramp steeper near vJump") {
    float sBase = 1.0f;
    float sPeak = 2.0f;
    float vJump = 100.0f;

    float tau_steep = 10.0f;  // sharper wall
    float tau_soft  = 40.0f;  // gradual wall

    float omega = vJump - 10.0f; // below jump

    float S_steep = JumpSensitivity(omega, sBase, sPeak, vJump, tau_steep);
    float S_soft  = JumpSensitivity(omega, sBase, sPeak, vJump, tau_soft);

    // Soft tau rises earlier, so S_soft should be higher
    REQUIRE(S_soft >= Approx(S_steep).margin(1e-6f));
}

// ---------------------------------------------------------
// 4. Edge cases: degenerate tau and negative omega
// ---------------------------------------------------------

TEST_CASE("Degenerate tau produces a hard step at vJump") {
    float sBase = 1.0f;
    float sPeak = 2.0f;
    float vJump = 80.0f;

    for (float tau : {0.0f, -10.0f}) {
        float S_before = JumpSensitivity(60.0f, sBase, sPeak, vJump, tau);
        float S_at     = JumpSensitivity(80.0f, sBase, sPeak, vJump, tau);
        float S_after  = JumpSensitivity(100.0f, sBase, sPeak, vJump, tau);

        REQUIRE(S_before == Approx(sBase).margin(1e-6f));
        REQUIRE(S_at     == Approx(sPeak).margin(1e-6f));
        REQUIRE(S_after  == Approx(sPeak).margin(1e-6f));
    }
}

TEST_CASE("Negative omega clamps effectively to Sbase via normalization") {
    float sBase = 1.0f;
    float sPeak = 2.0f;
    float vJump = 80.0f;
    float tau   = 20.0f;

    float Sneg = JumpSensitivity(-50.0f, sBase, sPeak, vJump, tau);

    // raw(-50) < raw(0) => t < 0 => clamped to 0 => S = sBase
    REQUIRE(Sneg == Approx(sBase).margin(1e-6f));
}
