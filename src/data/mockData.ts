import type { Participant, Referral } from '../types'

export const STORAGE_KEY = 'asr-tracker-v1'

export const mockParticipants: Participant[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    parentName: 'Maya Chen',
    email: 'maya@example.com',
    zip: '78704',
    grade: '7th grade',
    referralCode: 'MAYA7K',
    referredById: null,
    status: 'enrolled',
    createdAt: daysAgo(12),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    parentName: 'Jordan Lee',
    email: 'jordan@example.com',
    zip: '78745',
    grade: '6th grade',
    referralCode: 'JORD42',
    referredById: null,
    status: 'registered',
    createdAt: daysAgo(10),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    parentName: 'Sam Rivera',
    email: 'sam@example.com',
    zip: '78704',
    grade: '8th grade',
    referralCode: 'SAM9R',
    referredById: '11111111-1111-1111-1111-111111111111',
    status: 'waitlisted',
    createdAt: daysAgo(8),
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    parentName: 'Avery Kim',
    email: 'avery@example.com',
    zip: '78613',
    grade: '7th grade',
    referralCode: 'AVE3X',
    referredById: '22222222-2222-2222-2222-222222222222',
    status: 'waitlisted',
    createdAt: daysAgo(5),
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    parentName: 'Casey Brooks',
    email: 'casey@example.com',
    zip: '78704',
    grade: '6th grade',
    referralCode: 'CAS88',
    referredById: '11111111-1111-1111-1111-111111111111',
    status: 'waitlisted',
    createdAt: daysAgo(3),
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    parentName: 'Riley Quinn',
    email: 'riley@example.com',
    zip: '78702',
    grade: '8th grade',
    referralCode: 'RIL2M',
    referredById: null,
    status: 'waitlisted',
    createdAt: daysAgo(2),
  },
]

export const mockReferrals: Referral[] = [
  {
    id: 'r1',
    referrerId: '11111111-1111-1111-1111-111111111111',
    referredId: '33333333-3333-3333-3333-333333333333',
    referredName: 'Sam Rivera',
    referredEmail: 'sam@example.com',
    status: 'waitlisted',
    submissionMethod: 'link',
    createdAt: daysAgo(8),
  },
  {
    id: 'r2',
    referrerId: '11111111-1111-1111-1111-111111111111',
    referredId: '55555555-5555-5555-5555-555555555555',
    referredName: 'Casey Brooks',
    referredEmail: 'casey@example.com',
    status: 'waitlisted',
    submissionMethod: 'link',
    createdAt: daysAgo(3),
  },
  {
    id: 'r3',
    referrerId: '22222222-2222-2222-2222-222222222222',
    referredId: '44444444-4444-4444-4444-444444444444',
    referredName: 'Avery Kim',
    referredEmail: 'avery@example.com',
    status: 'waitlisted',
    submissionMethod: 'staff_attributed',
    createdAt: daysAgo(5),
  },
]

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}
