import { showMessage } from "react-native-flash-message";

export const GrayToast = (message: string) => {
  showMessage({
    message,
    floating: true,
    position: "center",
    duration: 2000,
    style: {
      backgroundColor: "rgba(60,60,60,0.9)",
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 12,
      minWidth: 180,
      alignItems: "center",
    },
    titleStyle: {
      color: "#fff",
      fontSize: 14,
      textAlign: "center",
    },
  });
};
