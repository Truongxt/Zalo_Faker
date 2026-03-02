// import { useState } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   KeyboardAvoidingView,
//   Platform,
//   ActivityIndicator,
//   Alert,
// } from "react-native";
// import { useRouter } from "expo-router";
// import { useSafeAreaInsets } from "react-native-safe-area-context";

// export default function ForgotPasswordScreen() {
//   const router = useRouter();
//   const insets = useSafeAreaInsets();

//   const [email, setEmail] = useState("");
//   const [isLoading, setIsLoading] = useState(false);
//   const [sent, setSent] = useState(false);

//   const handleReset = async () => {
//     if (!email.trim()) {
//       Alert.alert("Lỗi", "Vui lòng nhập email");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       await authService.resetPassword(email);
//       setSent(true);
//     } catch (error: any) {
//       Alert.alert("Lỗi", error.message || "Không thể gửi email");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <KeyboardAvoidingView
//       behavior={Platform.OS === "ios" ? "padding" : "height"}
//       className="flex-1 bg-white"
//       style={{ paddingTop: insets.top }}
//     >
//       <View className="flex-1 justify-center px-6">
//         {/* Back button */}
//         <TouchableOpacity
//           onPress={() => router.back()}
//           className="absolute top-4 left-6"
//           style={{ top: insets.top + 16 }}
//         >
//           <Text className="text-[#0068FF] text-base">← Quay lại</Text>
//         </TouchableOpacity>

//         {sent ? (
//           <View className="items-center">
//             <Text className="text-5xl mb-4">✉️</Text>
//             <Text className="text-xl font-bold text-gray-900 mb-2">
//               Đã gửi email!
//             </Text>
//             <Text className="text-gray-500 text-center">
//               Kiểm tra hộp thư {email} để đặt lại mật khẩu.
//             </Text>
//             <TouchableOpacity
//               onPress={() => router.replace("/(auth)/login")}
//               className="h-12 bg-[#0068FF] rounded-xl items-center justify-center mt-8 w-full"
//             >
//               <Text className="text-white font-semibold">Về đăng nhập</Text>
//             </TouchableOpacity>
//           </View>
//         ) : (
//           <>
//             <View className="items-center mb-8">
//               <Text className="text-2xl font-bold text-gray-900">
//                 Quên mật khẩu
//               </Text>
//               <Text className="text-gray-500 mt-1 text-center">
//                 Nhập email để nhận link đặt lại mật khẩu
//               </Text>
//             </View>

//             <View className="gap-4">
//               <TextInput
//                 value={email}
//                 onChangeText={setEmail}
//                 placeholder="Email của bạn"
//                 keyboardType="email-address"
//                 autoCapitalize="none"
//                 className="h-12 px-4 bg-gray-100 rounded-xl text-gray-900"
//                 placeholderTextColor="#9CA3AF"
//               />

//               <TouchableOpacity
//                 onPress={handleReset}
//                 disabled={isLoading}
//                 className="h-12 bg-[#0068FF] rounded-xl items-center justify-center"
//               >
//                 {isLoading ? (
//                   <ActivityIndicator color="white" />
//                 ) : (
//                   <Text className="text-white font-semibold">
//                     Gửi link đặt lại
//                   </Text>
//                 )}
//               </TouchableOpacity>
//             </View>
//           </>
//         )}
//       </View>
//     </KeyboardAvoidingView>
//   );
// }
