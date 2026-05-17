import { User, useAuthStore } from '@/stores/authStore'
import { baseAPI, fetchWithAuth } from './api'

export interface LoginHistoryItem {
    loginId: string
    userId: string
    loginAt: string
    platform: string
    deviceInfo: string
    ipAddress: string
}

export interface QrLoginSession {
    sessionId: string
    pollToken: string
    qrCodeValue: string
    expiresAt: string
    expiresIn: number
}

export interface QrLoginStatus {
    status: 'pending' | 'confirmed' | 'expired' | 'consumed'
    expiresAt?: string
    auth?: {
        user: any
        accessToken: string
        refreshToken: string
    }
}

const mapServerUserToClient = (rawUser: any): User => ({
    ...rawUser,
    id: rawUser.userId,
    avatarUrl: rawUser.avartarUrl,
    fullName: rawUser.userName || 'User',
    phone: rawUser.phone || null,
    birthday: rawUser.birthday || null,
    gender: rawUser.gender || 'other',
    hasHiddenPin: !!rawUser.hiddenChatPin,
})

export const authService = {
    async register(data: {
        fullName: string;
        email: string;
        password: string;
        phone: string;
        birthday: string;
        gender: string;
        avatarUrl?: string;
    }): Promise<{ user: User; accessToken: string }> {
        const response = await fetch(`${baseAPI}/users/register/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: data.email,
                password: data.password,
                userName: data.fullName,
                gender: data.gender,
                phone: data.phone,
                status: "active",
                avartarUrl: data.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName)}&background=0068FF&color=fff&size=256`,
                birthday: data.birthday
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Registration failed');
        }
        
        // Auto-login after successful registration to return token set.
        return await this.login(data.email, data.password);
    },

    async login(identifier: string, password: string): Promise<{ user: User; accessToken: string, refreshToken: string }> {
        const normalizedIdentifier = identifier.trim();
        const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'Web';

        const response = await fetch(`${baseAPI}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: normalizedIdentifier,
                // Backward-compatible payload for older backend versions.
                email: normalizedIdentifier,
                password,
                platform: 'web',
                deviceInfo,
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Dang nhap that bai. Sai email hoac password.');
        }

        const data = await response.json();
        
        const mappedUser: User = mapServerUserToClient(data.user)

        return {
            user: mappedUser,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken
        };
    },

    async loginWithGoogle(): Promise<void> {
        throw new Error('Dang nhap Google chua duoc ho tro tai Backend.');
    },

    async createQrLoginSession(): Promise<QrLoginSession> {
        const response = await fetch(`${baseAPI}/users/qr-login/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Khong tao duoc phien dang nhap QR');
        }

        return response.json();
    },

    async getQrLoginStatus(sessionId: string, pollToken: string): Promise<QrLoginStatus> {
        const response = await fetch(
            `${baseAPI}/users/qr-login/session/${encodeURIComponent(sessionId)}/status?pollToken=${encodeURIComponent(pollToken)}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Khong kiem tra duoc trang thai QR login');
        }

        const payload = await response.json();
        if (payload?.status === 'confirmed' && payload?.auth?.user) {
            payload.auth.user = mapServerUserToClient(payload.auth.user);
        }
        return payload;
    },
    async logout(): Promise<void> {
        const store = useAuthStore.getState();
        if (store.refreshToken) {
            try {
                // Backend supports refreshToken to revoke active session.
                await fetchWithAuth(`/users/logout`, {
                    method: 'POST',
                    body: JSON.stringify({ refreshToken: store.refreshToken })
                });
            } catch (err) {
                console.error("Loi khi goi API logout backend:", err);
            }
        }
    },

    async updateProfile(updates: { 
        fullName?: string; 
        bio?: string; 
        avatarUrl?: string;
        phone?: string;
        birthday?: string;
        gender?: string;
    }): Promise<void> {
        const store = useAuthStore.getState();
        if (!store.user?.id && !store.user?.userId) throw new Error('Not authenticated');

        const userId = store.user?.id || store.user?.userId;
        const backendUpdates: any = {};
        if (updates.fullName !== undefined) backendUpdates.userName = updates.fullName;
        if (updates.avatarUrl !== undefined) backendUpdates.avartarUrl = updates.avatarUrl;
        if (updates.phone !== undefined) backendUpdates.phone = updates.phone;
        if (updates.birthday !== undefined) backendUpdates.birthday = updates.birthday;
        if (updates.gender !== undefined) backendUpdates.gender = updates.gender;
        if (updates.bio !== undefined) backendUpdates.bio = updates.bio;
        
        await fetchWithAuth(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(backendUpdates)
        });
    },

    async uploadAvatar(file: File): Promise<string> {
        const formData = new FormData();
        formData.append("file", file);
        
        const response = await fetch(`${baseAPI}/upload`, {
            method: "POST",
            headers: {
                ...this.getAuthHeaders()
            },
            body: formData,
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.url;
    },

    getAuthHeaders(): Record<string, string> {
        const token = useAuthStore.getState().accessToken;
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    async requestForgotPasswordOtp(email: string): Promise<{ message: string; expiresIn: number }> {
        const response = await fetch(`${baseAPI}/users/forgot-password/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Khong the gui OTP');
        }
        return response.json();
    },

    async verifyForgotPasswordOtp(email: string, otp: string): Promise<{ message: string; expiresIn: number }> {
        const response = await fetch(`${baseAPI}/users/forgot-password/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Xac thuc OTP that bai');
        }
        return response.json();
    },

    async resetForgotPassword(email: string, newPassword: string): Promise<{ message: string }> {
        const response = await fetch(`${baseAPI}/users/forgot-password/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newPassword })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Khong the dat lai mat khau');
        }
        return response.json();
    },

    async registerRequestOtp(email: string): Promise<{ message: string; expiresIn: number }> {
        const response = await fetch(`${baseAPI}/users/register/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Khong the gui OTP');
        }
        return response.json();
    },

    async registerVerifyOtp(email: string, otp: string): Promise<{ message: string; expiresIn: number }> {
        const response = await fetch(`${baseAPI}/users/register/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Xac thuc OTP that bai');
        }
        return response.json();
    },

    async getSession() {
        return null;
    },

    async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ message: string; user: User }> {
        const response = await fetchWithAuth(`/users/${userId}/change-password`, {
            method: 'POST',
            body: JSON.stringify({ oldPassword, newPassword }),
        })
        return response.json()
    },

    async lockAccount(userId: string, currentPassword: string): Promise<{ message: string; user: User }> {
        const response = await fetchWithAuth(`/users/${userId}/lock-account`, {
            method: 'POST',
            body: JSON.stringify({ currentPassword }),
        })
        return response.json()
    },

    async requestPermanentLockOtp(userId: string): Promise<{ message: string; expiresIn: number }> {
        const response = await fetchWithAuth(`/users/${userId}/lock-account/request-otp`, {
            method: 'POST',
        })
        return response.json()
    },

    async permanentLockAccount(
        userId: string,
        password: string,
        otp: string,
        confirmIrreversible: boolean,
    ): Promise<{ message: string; user: User }> {
        const response = await fetchWithAuth(`/users/${userId}/lock-account/permanent`, {
            method: 'POST',
            body: JSON.stringify({ password, otp, confirmIrreversible }),
        })
        return response.json()
    },

    async getLoginHistory(userId: string, limit = 20): Promise<LoginHistoryItem[]> {
        const response = await fetchWithAuth(`/users/${userId}/login-history?limit=${limit}`)
        return response.json()
    },

    async unlockAccount(email: string, password: string): Promise<{ message: string; user: User }> {
        const response = await fetch(`${baseAPI}/users/unlock-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Mo khoa tai khoan that bai')
        }
        return response.json()
    },

    onAuthStateChange(_callback: (event: string, session: any) => void) {
        return { data: { subscription: { unsubscribe: () => {} } } };
    },

    // ===== HIDDEN CHAT PIN =====
    async getHiddenPinStatus(userId: string): Promise<{ isSet: boolean }> {
        const response = await fetchWithAuth(`/users/${userId}/hidden-pin/status`)
        return response.json()
    },

    async updateHiddenPin(userId: string, pin: string): Promise<{ message: string }> {
        const response = await fetchWithAuth(`/users/${userId}/hidden-pin`, {
            method: 'PUT',
            body: JSON.stringify({ pin })
        })
        return response.json()
    },

    async verifyHiddenPin(userId: string, pin: string): Promise<{ success: boolean }> {
        const response = await fetchWithAuth(`/users/${userId}/hidden-pin/verify`, {
            method: 'POST',
            body: JSON.stringify({ pin })
        })
        return response.json()
    },

    async resetHiddenPin(userId: string, password: string, newPin: string): Promise<{ success: boolean; message: string }> {
        const response = await fetchWithAuth(`/users/${userId}/hidden-pin/reset`, {
            method: 'POST',
            body: JSON.stringify({ password, newPin })
        })
        return response.json()
    }
}

export default authService
