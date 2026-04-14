import type { Participant } from '@/stores/chatStore'

export type MuteDurationOption = '1_hour' | '4_hours' | 'until_8am' | 'until_turn_on'

export interface MuteState {
    isMuted: boolean
    muteUntil: string | null
}

export const getMuteUntil = (option: MuteDurationOption, now = new Date()): string | null => {
    const next = new Date(now)

    switch (option) {
        case '1_hour':
            next.setHours(next.getHours() + 1)
            return next.toISOString()
        case '4_hours':
            next.setHours(next.getHours() + 4)
            return next.toISOString()
        case 'until_8am': {
            const target = new Date(now)
            target.setHours(8, 0, 0, 0)
            if (target.getTime() <= now.getTime()) {
                target.setDate(target.getDate() + 1)
            }
            return target.toISOString()
        }
        case 'until_turn_on':
            return null
        default:
            return null
    }
}

export const getParticipantMuteState = (
    participant?: Pick<Participant, 'isMuted' | 'muteUntil'> | null,
    now = new Date()
): MuteState => {
    if (!participant?.isMuted) {
        return { isMuted: false, muteUntil: null }
    }

    if (!participant.muteUntil) {
        return { isMuted: true, muteUntil: null }
    }

    const muteUntilTs = Date.parse(participant.muteUntil)
    if (!Number.isFinite(muteUntilTs)) {
        return { isMuted: true, muteUntil: participant.muteUntil }
    }

    if (muteUntilTs <= now.getTime()) {
        return { isMuted: false, muteUntil: null }
    }

    return {
        isMuted: true,
        muteUntil: new Date(muteUntilTs).toISOString(),
    }
}

export const formatMuteUntilLabel = (muteUntil?: string | null): string => {
    if (!muteUntil) return 'cho đến khi bạn bật lại'

    const date = new Date(muteUntil)
    if (Number.isNaN(date.getTime())) return 'đến khi bạn bật lại'

    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    }).format(date)
}
