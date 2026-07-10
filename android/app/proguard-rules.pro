# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Stripe
-keep class com.stripe.android.pushProvisioning.** { *; }
-dontwarn com.stripe.android.pushProvisioning.**

# Expo Modules
-keep class expo.modules.kotlin.runtime.Runtime { *; }
-keep class expo.modules.kotlin.services.** { *; }
-dontwarn expo.modules.kotlin.runtime.**
-dontwarn expo.modules.kotlin.services.**

# Keep all Expo modules
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**

# Keep Stripe React Native SDK
-keep class com.reactnativestripesdk.** { *; }
-dontwarn com.reactnativestripesdk.**

# General keep rules
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
