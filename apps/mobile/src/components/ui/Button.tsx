import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
} from "react-native";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  title,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className: extraClass,
  ...props
}: ButtonProps) {
  const baseClass = "items-center justify-center rounded-xl";

  const variantClasses = {
    primary: "bg-[#0068FF]",
    secondary: "bg-gray-100",
    danger: "bg-red-500",
    ghost: "bg-transparent",
  };

  const sizeClasses = {
    sm: "h-9 px-3",
    md: "h-12 px-4",
    lg: "h-14 px-6",
  };

  const textVariantClasses = {
    primary: "text-white",
    secondary: "text-gray-700",
    danger: "text-white",
    ghost: "text-[#0068FF]",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <TouchableOpacity
      className={`${baseClass} ${variantClasses[variant]} ${sizeClasses[size]} ${
        disabled || isLoading ? "opacity-50" : ""
      } ${extraClass || ""}`}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          color={
            variant === "secondary" || variant === "ghost" ? "#0068FF" : "white"
          }
        />
      ) : (
        <Text
          className={`font-semibold ${textVariantClasses[variant]} ${textSizeClasses[size]}`}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
