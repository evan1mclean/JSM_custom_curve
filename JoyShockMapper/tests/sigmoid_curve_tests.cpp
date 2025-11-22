#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include <cmath>
#include "SigmoidCurve.h"   // or whatever header declares SigmoidSensitivity

using Catch::Approx;

// Signature:
//
// float SigmoidSensitivity(float omega,
//                          float sMin, float sMax,
//                          float vMid, float width);
//
// Normalized sigmoid:
//   raw(ω)  = 1 / (1 + exp(-(ω - vMid)/width))
//   σ0      = raw(0)
//   t(ω)    = (raw(ω) - σ0) / (1 - σ0)
//   S(ω)    = sMin + (sMax - sMin) * clamp(t, 0, 1)
//
// Ensures S(0) = sMin, S(∞) = sMax, smooth and monotone.


// ---------------------------------------------------------
// 1. Basic anchors
// ---------------------------------------------------------

TEST_CASE("SigmoidSensitivity at omega = 0 returns sMin") {
    float sMin  = 0.5f;
    float sMax  = 1.5f;
    float vMid  = 40.0f;
    float width = 20.0f;

    float S = SigmoidSensitivity(0.0f, sMin, sMax, vMid, width);
    REQUIRE(S == Approx(sMin).margin(1e-6f));
}

TEST_CASE("SigmoidSensitivity approaches sMax at large omega") {
    float sMin  = 0.5f;
    float sMax  = 1.5f;
    float vMid  = 40.0f;
    float width = 20.0f;

    float omega = 1e6f;
    float S = SigmoidSensitivity(omega, sMin, sMax, vMid, width);

    REQUIRE(S <= Approx(sMax).margin(1e-6f));
    REQUIRE(S == Approx(sMax).margin(1e-3f));
}


// ---------------------------------------------------------
// 2. Range and monotonicity
// ---------------------------------------------------------

TEST_CASE("SigmoidSensitivity stays within [sMin, sMax]") {
    float sMin  = 0.5f;
    float sMax  = 1.5f;
    float vMid  = 40.0f;
    float width = 20.0f;

    for (float omega = 0.0f; omega <= 200.0f; omega += 2.0f) {
        float S = SigmoidSensitivity(omega, sMin, sMax, vMid, width);
        REQUIRE(S >= Approx(sMin).margin(1e-6f));
        REQUIRE(S <= Approx(sMax).margin(1e-6f));
    }
}

TEST_CASE("SigmoidSensitivity is monotone non-decreasing in omega") {
    float sMin  = 0.5f;
    float sMax  = 1.5f;
    float vMid  = 40.0f;
    float width = 20.0f;

    float prev = SigmoidSensitivity(0.0f, sMin, sMax, vMid, width);

    for (float omega = 0.0f; omega <= 200.0f; omega += 2.0f) {
        float cur = SigmoidSensitivity(omega, sMin, sMax, vMid, width);
        REQUIRE(cur >= Approx(prev).margin(1e-6f));
        prev = cur;
    }
}


// ---------------------------------------------------------
// 3. Parameter behavior
// ---------------------------------------------------------

TEST_CASE("Increasing vMid shifts the curve to the right") {
    float sMin  = 0.5f;
    float sMax  = 1.5f;
    float width = 20.0f;

    float vMid_left  = 30.0f;
    float vMid_right = 60.0f;

    float omega = 40.0f; // between the two midpoints

    float S_left  = SigmoidSensitivity(omega, sMin, sMax, vMid_left,  width);
    float S_right = SigmoidSensitivity(omega, sMin, sMax, vMid_right, width);

    // Larger vMid => curve is shifted right => lower S at the same omega
    REQUIRE(S_right <= Approx(S_left).margin(1e-6f));
}

TEST_CASE("Smaller width makes the transition steeper around vMid") {
    float sMin = 0.5f;
    float sMax = 1.5f;
    float vMid = 50.0f;

    float width_wide  = 40.0f;
    float width_narrow= 10.0f;

    float omega = vMid; // centered at the midpoint

    float S_wide   = SigmoidSensitivity(omega, sMin, sMax, vMid, width_wide);
    float S_narrow = SigmoidSensitivity(omega, sMin, sMax, vMid, width_narrow);

    // At vMid, narrower width gives a steeper rise, so S_narrow > S_wide
    REQUIRE(S_narrow >= Approx(S_wide).margin(1e-6f));
}


// ---------------------------------------------------------
// 4. Edge cases
// ---------------------------------------------------------

TEST_CASE("Non-positive width still returns finite values within [sMin, sMax]") {
    float sMin = 0.5f;
    float sMax = 1.5f;
    float vMid = 40.0f;

    for (float width : {0.0f, -10.0f}) {
        for (float omega = 0.0f; omega <= 200.0f; omega += 25.0f) {
            float S = SigmoidSensitivity(omega, sMin, sMax, vMid, width);
            REQUIRE(std::isfinite(S));
            REQUIRE(S >= Approx(sMin).margin(1e-6f));
            REQUIRE(S <= Approx(sMax).margin(1e-6f));
        }
    }
}

TEST_CASE("Negative omega clamps to sMin due to normalization and clamp") {
    float sMin  = 0.5f;
    float sMax  = 1.5f;
    float vMid  = 40.0f;
    float width = 20.0f;

    float Sneg = SigmoidSensitivity(-100.0f, sMin, sMax, vMid, width);
    REQUIRE(Sneg == Approx(sMin).margin(1e-6f));
}


// ---------------------------------------------------------
// 5. Golden sample (analytic case)
// ---------------------------------------------------------
//
// Choose sMin = 0, sMax = 1, vMid = 0, width = 1.
//
// raw(ω)  = 1 / (1 + exp(-ω))
// raw(0)  = 1 / (1 + 1) = 0.5
// denom   = 1 - 0.5 = 0.5
//
// Let ω = ln(3):
//   raw(ln 3) = 1 / (1 + exp(-ln 3))
//             = 1 / (1 + 1/3)
//             = 3/4
//   t(ω)      = (3/4 - 1/2) / 1/2 = (1/4) / (1/2) = 1/2
//   S(ω)      = t(ω) = 0.5
//
TEST_CASE("SigmoidSensitivity matches analytic golden sample") {
    float sMin  = 0.0f;
    float sMax  = 1.0f;
    float vMid  = 0.0f;
    float width = 1.0f;

    const float omega = std::log(3.0f); // ~1.0986123

    float S0 = SigmoidSensitivity(0.0f,   sMin, sMax, vMid, width);
    float S1 = SigmoidSensitivity(omega,  sMin, sMax, vMid, width);
    float S2 = SigmoidSensitivity(10.0f,  sMin, sMax, vMid, width);

    REQUIRE(S0 == Approx(0.0f).margin(1e-6f));  // S(0) = sMin
    REQUIRE(S1 == Approx(0.5f).margin(1e-4f));  // S(ln 3) ≈ 0.5
    REQUIRE(S2 == Approx(1.0f).margin(1e-3f));  // approaches sMax
}
