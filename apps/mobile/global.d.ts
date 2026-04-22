declare module "expo-contacts" {
  export type PermissionStatus = "undetermined" | "denied" | "granted";

  export type Contact = {
    phoneNumbers?: Array<{ number?: string | null }>;
  };

  export const Fields: {
    PhoneNumbers: string;
  };

  export function getPermissionsAsync(): Promise<{ status: PermissionStatus }>;
  export function requestPermissionsAsync(): Promise<{ status: PermissionStatus }>;
  export function getContactsAsync(options?: {
    fields?: string[];
  }): Promise<{ data: Contact[] }>;
}

declare module "expo-device" {
  export const isDevice: boolean;
}
