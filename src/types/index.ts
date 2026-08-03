export type ParticipantStatus = 'waitlisted' | 'registered' | 'enrolled' | 'declined'
export type SubmissionMethod = 'link' | 'direct_submit' | 'staff_attributed'

export interface Child {
  id: string
  participantId: string
  firstName: string
  grade: string
}

export interface Participant {
  id: string
  parentName: string
  email: string
  zip: string
  grade: string
  referralCode: string
  referredById: string | null
  status: ParticipantStatus
  createdAt: string
}

export interface Referral {
  id: string
  referrerId: string
  referredId: string | null
  referredName: string
  referredEmail: string
  status: ParticipantStatus
  submissionMethod: SubmissionMethod
  createdAt: string
}

export interface ParticipantDetail extends Participant {
  referredBy: Participant | null
  referralsMade: Referral[]
  referredParticipants: Participant[]
  children: Child[]
}
