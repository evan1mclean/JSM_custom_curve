// power_curve_tests.cpp
#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include <cmath>
#include "PowerCurve.h"  // declares PowerSensitivity

using Catch::Approx;

// We assume:
//   float PowerSensitivity(float omega,
//                          float scale,
//                          float exponent,
//                          float offset);
// and
//   S(omega) = (scale * omega)^exponent + offset


// ---------------------------------------------------------
// 1. Basic behavior tests
// ---------------------------------------------------------

TEST_CASE("PowerSensitivity at omega = 0 returns offset") {
    float scale    = 1.0f;
    float exponent = 1.3f;   // any >0
    float offset   = 0.8f;

    float S = PowerSensitivity(0.0f, scale, exponent, offset);
    REQUIRE(S == Approx(offset).margin(1e-6f));
}

TEST_CASE("PowerSensitivity equals linear when exponent = 1 and offset = 0") {
    float scale    = 0.5f;
    float exponent = 1.0f;
    float offset   = 0.0f;

    // Then S(omega) = scale * omega
    for (float omega = 0.0f; omega <= 10.0f; omega += 1.0f) {
        float S = PowerSensitivity(omega, scale, exponent, offset);
        float expected = scale * omega;
        REQUIRE(S == Approx(expected).margin(1e-6f));
    }
}

TEST_CASE("PowerSensitivity with exponent = 0 is a flat line at offset + 1") {
    float scale    = 2.0f;
    float exponent = 0.0f;   // (scale * omega)^0 = 1 for omega > 0
    float offset   = 0.5f;

    // Note: by definition pow(0,0) is tricky, so we avoid omega=0 here.
    for (float omega = 0.1f; omega <= 10.0f; omega += 1.0f) {
        float S = PowerSensitivity(omega, scale, exponent, offset);
        float expected = 1.0f + offset;
        REQUIRE(S == Approx(expected).margin(1e-6f));
    }
}


// ---------------------------------------------------------
// 2. Monotonicity and parameter behavior
// ---------------------------------------------------------

TEST_CASE("PowerSensitivity is non-decreasing in omega when scale>0 and exponent>0") {
    float scale    = 0.01f;
    float exponent = 0.5f;
    float offset   = 1.0f;

    float prev = PowerSensitivity(0.0f, scale, exponent, offset);

    for (float omega = 0.0f; omega <= 500.0f; omega += 5.0f) {
        float cur = PowerSensitivity(omega, scale, exponent, offset);
        REQUIRE(cur >= Approx(prev).margin(1e-6f));
        prev = cur;
    }
}

TEST_CASE("Increasing offset shifts the curve upward") {
    float scale    = 0.01f;
    float exponent = 0.5f;
    float offset1  = 0.5f;
    float offset2  = 1.0f;

    for (float omega = 0.0f; omega <= 200.0f; omega += 10.0f) {
        float s1 = PowerSensitivity(omega, scale, exponent, offset1);
        float s2 = PowerSensitivity(omega, scale, exponent, offset2);
        REQUIRE(s2 >= Approx(s1 + (offset2 - offset1)).margin(1e-6f));
    }
}

TEST_CASE("Increasing exponent increases the high-omega aggressiveness") {
    float scale = 0.01f;
    float exponent1 = 0.3f;
    float exponent2 = 0.7f;
    float offset = 1.0f;

    float omega_low  = 10.0f;
    float omega_high = 200.0f;

    float slow_low  = PowerSensitivity(omega_low,  scale, exponent1, offset);
    float fast_low  = PowerSensitivity(omega_high, scale, exponent1, offset);

    float slow_high = PowerSensitivity(omega_low,  scale, exponent2, offset);
    float fast_high = PowerSensitivity(omega_high, scale, exponent2, offset);

    // The gap between low and high enlarges as exponent increases
    float gap1 = fast_low  - slow_low;
    float gap2 = fast_high - slow_high;

    REQUIRE(gap2 > gap1);
}

// ---------------------------------------------------------
// 3. Edge cases
// ---------------------------------------------------------

TEST_CASE("PowerSensitivity stays finite for reasonable inputs") {
    float scale    = 0.01f;
    float exponent = 0.5f;
    float offset   = 1.0f;

    // Test a range of omegas including quite large
    for (float omega : {0.0f, 1.0f, 10.0f, 100.0f, 1000.0f, 10000.0f}) {
        float S = PowerSensitivity(omega, scale, exponent, offset);
        REQUIRE(std::isfinite(S));
    }
}


// ---------------------------------------------------------
// 4. Golden sample tests (for a specific param set)
// ---------------------------------------------------------
//
// For these, we choose parameters where the math is straightforward:
//
//   scale    = 0.01
//   exponent = 0.5
//   offset   = 1.0
//
// => S(omega) = (0.01 * omega)^(0.5) + 1.0
//             = sqrt(0.01 * omega) + 1.0
//
// Check a few points where sqrt is easy:
//   omega=0   -> S = 1.0
//   omega=25  -> S = sqrt(0.25) + 1 = 0.5 + 1 = 1.5
//   omega=100 -> S = sqrt(1.0) + 1 = 2.0
//   omega=400 -> S = sqrt(4.0) + 1 = 3.0
//
TEST_CASE("PowerSensitivity matches golden samples for scale=0.01, exponent=0.5, offset=1.0") {
    float scale    = 0.01f;
    float exponent = 0.5f;
    float offset   = 1.0f;

    REQUIRE(PowerSensitivity(0.0f,   scale, exponent, offset) == Approx(1.0f).margin(1e-6f));
    REQUIRE(PowerSensitivity(25.0f,  scale, exponent, offset) == Approx(1.5f).margin(1e-6f));
    REQUIRE(PowerSensitivity(100.0f, scale, exponent, offset) == Approx(2.0f).margin(1e-6f));
    REQUIRE(PowerSensitivity(400.0f, scale, exponent, offset) == Approx(3.0f).margin(1e-6f));
}
