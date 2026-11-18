//
//  Generated file. Do not edit.
//

// clang-format off

#include "generated_plugin_registrant.h"

#include <flutter_onnxruntime/flutter_onnxruntime_plugin.h>
#include <flutter_webrtc/flutter_web_r_t_c_plugin.h>
#include <hand_detection/hand_detection_plugin.h>

void fl_register_plugins(FlPluginRegistry* registry) {
  g_autoptr(FlPluginRegistrar) flutter_onnxruntime_registrar =
      fl_plugin_registry_get_registrar_for_plugin(registry, "FlutterOnnxruntimePlugin");
  flutter_onnxruntime_plugin_register_with_registrar(flutter_onnxruntime_registrar);
  g_autoptr(FlPluginRegistrar) flutter_webrtc_registrar =
      fl_plugin_registry_get_registrar_for_plugin(registry, "FlutterWebRTCPlugin");
  flutter_web_r_t_c_plugin_register_with_registrar(flutter_webrtc_registrar);
  g_autoptr(FlPluginRegistrar) hand_detection_registrar =
      fl_plugin_registry_get_registrar_for_plugin(registry, "HandDetectionPlugin");
  hand_detection_plugin_register_with_registrar(hand_detection_registrar);
}
