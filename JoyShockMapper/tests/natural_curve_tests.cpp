#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "NaturalCurve.h"
#include <cmath>

// =========================================================
// NaturalSensitivity signature:
//
//   float NaturalSensitivity(float omega,
//                            float sMin,
//                            float sMax,
//                            float vHalf);
//
// We treat `omega` as the input speed (dots/ms).
// =========================================================


// ---------------------------------------------------------
// 1. Basic shape / anchor tests
// ---------------------------------------------------------

TEST_CASE("NaturalSensitivity at omega = 0 returns sMin") {
    float sMin  = 0.3f;
    float sMax  = 1.0f;
    float vHalf = 10.0f;

    float S = NaturalSensitivity(0.0f, sMin, sMax, vHalf);
    REQUIRE(S == Catch::Approx(sMin));
}

TEST_CASE("NaturalSensitivity at vHalf gives midpoint between sMin and sMax") {
    float sMin  = 0.3f;
    float sMax  = 1.0f;
    float vHalf = 10.0f;

    float S = NaturalSensitivity(vHalf, sMin, sMax, vHalf);
    float expected = (sMin + sMax) / 2.0f;

    REQUIRE(S == Catch::Approx(expected));
}

TEST_CASE("NaturalSensitivity approaches sMax at high omega") {
    float sMin  = 0.3f;
    float sMax  = 1.0f;
    float vHalf = 10.0f;

    float omega = 1000.0f;
    float S = NaturalSensitivity(omega, sMin, sMax, vHalf);

    REQUIRE(S <= Catch::Approx(sMax).margin(1e-6));
    REQUIRE(S == Catch::Approx(sMax).margin(1e-4));
}


// ---------------------------------------------------------
// 2. Range and monotonicity tests
// ---------------------------------------------------------

TEST_CASE("NaturalSensitivity stays within [sMin, sMax]") {
    float sMin  = 0.3f;
    float sMax  = 1.0f;
    float vHalf = 10.0f;

    for (float omega = 0.0f; omega <= 200.0f; omega += 1.0f) {
        float S = NaturalSensitivity(omega, sMin, sMax, vHalf);
        REQUIRE(S >= Catch::Approx(sMin).margin(1e-6));
        REQUIRE(S <= Catch::Approx(sMax).margin(1e-6));
    }
}

TEST_CASE("NaturalSensitivity is monotone non-decreasing in omega") {
    float sMin  = 0.3f;
    float sMax  = 1.0f;
    float vHalf = 10.0f;

    float prev = NaturalSensitivity(0.0f, sMin, sMax, vHalf);

    for (float omega = 0.0f; omega <= 200.0f; omega += 1.0f) {
        float cur = NaturalSensitivity(omega, sMin, sMax, vHalf);
        REQUIRE(cur >= Catch::Approx(prev).margin(1e-6));  // allow tiny FP noise
        prev = cur;
    }
}


// ---------------------------------------------------------
// 3. Parameter behavior tests
// ---------------------------------------------------------

TEST_CASE("Increasing sMax never decreases sensitivity at any omega") {
    float sMin  = 0.3f;
    float vHalf = 10.0f;

    float sMax1 = 1.0f;
    float sMax2 = 1.2f;  // higher max

    for (float omega = 0.0f; omega <= 200.0f; omega += 2.0f) {
        float s1 = NaturalSensitivity(omega, sMin, sMax1, vHalf);
        float s2 = NaturalSensitivity(omega, sMin, sMax2, vHalf);
        REQUIRE(s2 >= Catch::Approx(s1).margin(1e-6));
    }
}

TEST_CASE("Increasing vHalf slows the curve's rise") {
    float sMin = 0.3f;
    float sMax = 1.0f;

    float vHalfFast = 5.0f;   // ramp up quickly
    float vHalfSlow = 20.0f;  // ramp up more slowly

    float omega = 10.0f;      // fixed speed

    float sFast = NaturalSensitivity(omega, sMin, sMax, vHalfFast);
    float sSlow = NaturalSensitivity(omega, sMin, sMax, vHalfSlow);

    // For the same omega, the slow curve should have lower sensitivity
    REQUIRE(sSlow <= Catch::Approx(sFast));
}


// ---------------------------------------------------------
// 4. Edge cases / numerical behavior
// ---------------------------------------------------------

TEST_CASE("Very small omega behaves like zero") {
    float sMin  = 0.3f;
    float sMax  = 1.0f;
    float vHalf = 10.0f;

    float omega = 1e-6f;
    float S = NaturalSensitivity(omega, sMin, sMax, vHalf);

    REQUIRE(S == Catch::Approx(sMin).margin(1e-6));
}

TEST_CASE("Very large omega stays finite and close to sMax") {
    float sMin  = 0.3f;
    float sMax  = 1.0f;
    float vHalf = 10.0f;

    float omega = 1e9f;
    float S = NaturalSensitivity(omega, sMin, sMax, vHalf);

    REQUIRE(std::isfinite(S));
    REQUIRE(S == Catch::Approx(sMax).margin(1e-4));
}


// ---------------------------------------------------------
// 5. Golden sample tests (optional)
// ---------------------------------------------------------
//
// These assume the implementation matches:
//   S(omega) = sMax - (sMax - sMin) * exp(-k * omega)
//   k = ln(2) / vHalf
// If your internal formula differs slightly, you can:
//   - recompute these with your exact JSM math, or
//   - relax the tolerances.
// ---------------------------------------------------------

TEST_CASE("NaturalSensitivity matches known values for specific omegas") {
    float sMin  = 0.3f;
    float sMax  = 1.0f;
    float vHalf = 10.0f;

    REQUIRE(NaturalSensitivity(0.0f,  sMin, sMax, vHalf) == Catch::Approx(0.3f).margin(1e-6));

    // These numbers are from the canonical exponential model; adjust if needed
    REQUIRE(NaturalSensitivity(5.0f,  sMin, sMax, vHalf) == Catch::Approx(0.505f).margin(1e-4));
    REQUIRE(NaturalSensitivity(10.0f, sMin, sMax, vHalf) == Catch::Approx(0.65f).margin(1e-2));   // midpoint
    REQUIRE(NaturalSensitivity(30.0f, sMin, sMax, vHalf) == Catch::Approx(0.9125f).margin(1e-3));
}
