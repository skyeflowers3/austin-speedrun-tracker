export type ParticipantStatus = 'waitlisted' | 'registered' | 'enrolled' | 'declined'
export type SubmissionMethod = 'link' | 'direct_submit' | 'staff_attributed'

export interface Child {
  id: string
  participantId: string
  firstName: string
  grade: string
  dateOfBirth?: string | null
  schoolName?: string | null
  schoolType?: string | null
  studentEmail?: string | null
  accommodations?: string | null
  hasHomeDevice?: boolean | null
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
  phone?: string | null
  street?: string | null
  unit?: string | null
  city?: string | null
  state?: string | null
  heardAbout?: string | null
  signedBy?: string | null
  coppaRequired?: boolean
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
