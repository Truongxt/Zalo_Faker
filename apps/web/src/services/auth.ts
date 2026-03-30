import { User, useAuthStore } from '@/stores/authStore'
import { baseAPI, fetchWithAuth } from './api'

export const authService = {
    async register(fullName: string, email: string, password: string): Promise<{ user: User; accessToken: string }> {
        // Backend yêu cầu: email, password, userName, gender, phone, status, avartarUrl, birthday
        // (Do design UI chưa có các trường này nên truyền tạm giá trị mặc định)
        const response = await fetch(`${baseAPI}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                userName: fullName,
                gender: "other",
                phone: "0000000000",
                status: "active",
                avartarUrl: "",
                birthday: "2000-01-01"
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Registration failed');
        }
        
        // Sau khi đăng ký thành công, gọi login để tự động đăng nhập và lấy chuỗi token
        return await this.login(email, password);
    },

    async login(email: string, password: string): Promise<{ user: User; accessToken: string, refreshToken: string }> {
        const response = await fetch(`${baseAPI}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Đăng nhập thất bại. Sai email hoặc password.');
        }

        const data = await response.json();
        
        const mappedUser: User = {
            ...data.user,
            id: data.user.userId, // Map userId từ BE sang id trên FE
            avatarUrl: data.user.avartarUrl,
            fullName: data.user.userName || 'User',
        }

        return {
            user: mappedUser,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken
        };
    },

    async loginWithGoogle(): Promise<void> {
        throw new Error('Đăng nhập Google chưa được hỗ trợ tại Backend.');
    },

    async logout(): Promise<void> {
        const store = useAuthStore.getState();
        if (store.refreshToken) {
            try {
                // Backend có hỗ trợ nhận vào refreshToken để logout
                await fetchWithAuth(`/users/logout`, {
                    method: 'POST',
                    body: JSON.stringify({ refreshToken: store.refreshToken })
                });
            } catch (err) {
                console.error("Lỗi khi gọi API logout backend:", err);
            }
        }
    },

    async updateProfile(updates: { fullName?: string; bio?: string; avatarUrl?: string }): Promise<void> {
        const store = useAuthStore.getState();
        if (!store.user?.userId) throw new Error('Not authenticated');

        const backendUpdates: any = {};
        if (updates.fullName) backendUpdates.userName = updates.fullName;
        if (updates.avatarUrl) backendUpdates.avartarUrl = updates.avatarUrl;
        
        await fetchWithAuth(`/users/${store.user.userId}`, {
            method: 'PUT',
            body: JSON.stringify(backendUpdates)
        });
    },

    async getSession() {
        return null;
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
        return { data: { subscription: { unsubscribe: () => {} } } };
    }
}

export default authService
