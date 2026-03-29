if(NOT TARGET react-native-worklets-core::rnworklets)
add_library(react-native-worklets-core::rnworklets SHARED IMPORTED)
set_target_properties(react-native-worklets-core::rnworklets PROPERTIES
    IMPORTED_LOCATION "/Users/gaurav/Downloads/interview prep/projects/kavach-main/node_modules/react-native-worklets-core/android/build/intermediates/cxx/Debug/5f5j66j3/obj/armeabi-v7a/librnworklets.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/gaurav/Downloads/interview prep/projects/kavach-main/node_modules/react-native-worklets-core/android/build/headers/rnworklets"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

