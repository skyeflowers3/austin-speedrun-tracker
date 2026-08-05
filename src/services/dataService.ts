import { mockParticipants, mockReferrals, STORAGE_KEY } from '../data/mockData'
import { newId } from '../lib/id'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type {
  Child,
  Participant,
  ParticipantDetail,
  ParticipantStatus,
  Referral,
  SubmissionMethod,
} from '../types'

export interface ChildInput {
  firstName: string
  grade: string
  dateOfBirth?: string | null
  schoolName?: string | null
  schoolType?: string | null
  studentEmail?: string | null
  accommodations?: string | null
  hasHomeDevice?: boolean | null
}

interface Store {
  participants: Participant[]
  referrals: Referral[]
  children: Child[]
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>
      return {
        participants: parsed.participants ?? structuredClone(mockParticipants),
        referrals: parsed.referrals ?? structuredClone(mockReferrals),
        children: parsed.children ?? [],
      }
    }
  } catch {
    /* ignore */
  }
  const fresh: Store = {
    participants: structuredClone(mockParticipants),
    referrals: structuredClone(mockReferrals),
    children: [],
  }
  saveStore(fresh)
  return fresh
}

function normalizeChildren(input: ChildInput[] | undefined): ChildInput[] {
  if (!input?.length) return []
  return input
    .map((c) => ({
      firstName: (c.firstName || '').trim(),
      grade: (c.grade || '').trim(),
      dateOfBirth: (c.dateOfBirth || '').trim() || null,
      schoolName: (c.schoolName || '').trim() || null,
      schoolType: (c.schoolType || '').trim() || null,
      studentEmail: (c.studentEmail || '').trim() || null,
      accommodations: (c.accommodations || '').trim() || null,
      hasHomeDevice: c.hasHomeDevice ?? null,
    }))
    .filter((c) => c.firstName || c.grade)
}

function validateChildren(children: ChildInput[]): void {
  for (const c of children) {
    if (!c.firstName || !c.grade) {
      throw new Error('Each child needs a first name and grade')
    }
  }
}

function gradeFromChildren(children: ChildInput[], fallback: string): string {
  if (children.length === 0) return fallback
  if (children.length === 1) return children[0].grade
  return 'Multiple kids'
}

async function replaceChildren(participantId: string, children: ChildInput[]): Promise<void> {
  if (supabase) {
    const { error: delErr } = await supabase
      .from('children')
      .delete()
      .eq('participant_id', participantId)
    if (delErr) throw delErr
    if (children.length === 0) return
    const { error: insErr } = await supabase.from('children').insert(
      children.map((c) => ({
        participant_id: participantId,
        first_name: c.firstName,
        grade: c.grade,
        date_of_birth: c.dateOfBirth,
        school_name: c.schoolName,
        school_type: c.schoolType,
        student_email: c.studentEmail,
        accommodations: c.accommodations,
        has_home_device: c.hasHomeDevice,
      })),
    )
    if (insErr) throw insErr
    return
  }

  const store = loadStore()
  store.children = store.children.filter((c) => c.participantId !== participantId)
  for (const c of children) {
    store.children.push({
      id: newId(),
      participantId,
      firstName: c.firstName,
      grade: c.grade,
      dateOfBirth: c.dateOfBirth ?? null,
      schoolName: c.schoolName ?? null,
      schoolType: c.schoolType ?? null,
      studentEmail: c.studentEmail ?? null,
      accommodations: c.accommodations ?? null,
      hasHomeDevice: c.hasHomeDevice ?? null,
    })
  }
  saveStore(store)
}

function saveStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function mapParticipant(row: Record<string, unknown>): Participant {
  return {
    id: String(row.id),
    parentName: String(row.parent_name),
    email: String(row.email),
    zip: String(row.zip),
    grade: String(row.grade),
    referralCode: String(row.referral_code),
    referredById: (row.referred_by_id as string | null) ?? null,
    status: row.status as ParticipantStatus,
    createdAt: String(row.created_at),
    phone: row.phone != null ? String(row.phone) : null,
    street: row.street != null ? String(row.street) : null,
    unit: row.unit != null ? String(row.unit) : null,
    city: row.city != null ? String(row.city) : null,
    state: row.state != null ? String(row.state) : null,
    heardAbout: row.heard_about != null ? String(row.heard_about) : null,
    signedBy: row.signed_by != null ? String(row.signed_by) : null,
    coppaRequired: Boolean(row.coppa_required),
  }
}

function mapReferral(row: Record<string, unknown>): Referral {
  return {
    id: String(row.id),
    referrerId: String(row.referrer_id),
    referredId: (row.referred_id as string | null) ?? null,
    referredName: String(row.referred_name),
    referredEmail: String(row.referred_email),
    status: row.status as ParticipantStatus,
    submissionMethod: row.submission_method as SubmissionMethod,
    createdAt: String(row.created_at),
  }
}

export async function listParticipants(): Promise<Participant[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row) => mapParticipant(row as Record<string, unknown>))
  }
  return loadStore().participants.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getParticipantDetail(id: string): Promise<ParticipantDetail | null> {
  const participants = await listParticipants()
  const participant = participants.find((p) => p.id === id)
  if (!participant) return null

  let referralsMade: Referral[] = []
  if (supabase) {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', id)
      .order('created_at', { ascending: false })
    if (error) throw error
    referralsMade = (data ?? []).map((row) => mapReferral(row as Record<string, unknown>))
  } else {
    referralsMade = loadStore().referrals.filter((r) => r.referrerId === id)
  }

  const referredBy = participant.referredById
    ? participants.find((p) => p.id === participant.referredById) ?? null
    : null

  const referredParticipants = referralsMade
    .map((r) => (r.referredId ? participants.find((p) => p.id === r.referredId) : null))
    .filter((p): p is Participant => Boolean(p))

  let children: Child[] = []
  if (supabase) {
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('participant_id', id)
      .order('created_at', { ascending: true })
    if (error) throw error
    children = (data ?? []).map((row) => ({
      id: String(row.id),
      participantId: String(row.participant_id),
      firstName: String(row.first_name),
      grade: String(row.grade),
      dateOfBirth: row.date_of_birth != null ? String(row.date_of_birth) : null,
      schoolName: row.school_name != null ? String(row.school_name) : null,
      schoolType: row.school_type != null ? String(row.school_type) : null,
      studentEmail: row.student_email != null ? String(row.student_email) : null,
      accommodations: row.accommodations != null ? String(row.accommodations) : null,
      hasHomeDevice:
        row.has_home_device == null ? null : Boolean(row.has_home_device),
    }))
  } else {
    children = loadStore().children.filter((c) => c.participantId === id)
  }

  return { ...participant, referredBy, referralsMade, referredParticipants, children }
}

export async function updateParticipantStatus(
  id: string,
  status: ParticipantStatus,
): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('participants')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return
  }
  const store = loadStore()
  const p = store.participants.find((x) => x.id === id)
  if (p) p.status = status
  for (const r of store.referrals) {
    if (r.referredId === id) r.status = status
  }
  saveStore(store)
}

export interface UpdateParticipantInput {
  parentName: string
  email: string
  zip: string
  grade: string
  children?: ChildInput[]
}

export async function updateParticipant(
  id: string,
  input: UpdateParticipantInput,
): Promise<void> {
  const parentName = input.parentName.trim()
  const email = input.email.trim().toLowerCase()
  const zip = input.zip.trim()
  const children = normalizeChildren(input.children)
  validateChildren(children)
  const grade = gradeFromChildren(children, input.grade.trim())
  if (!parentName || !email || !/^\d{5}$/.test(zip) || !grade) {
    throw new Error('Name, email, 5-digit zip, and grade are required')
  }

  if (supabase) {
    const { error } = await supabase
      .from('participants')
      .update({
        parent_name: parentName,
        email,
        zip,
        grade,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
    if (input.children !== undefined) {
      await replaceChildren(id, children)
    }
    return
  }

  const store = loadStore()
  const p = store.participants.find((x) => x.id === id)
  if (!p) throw new Error('Participant not found')
  p.parentName = parentName
  p.email = email
  p.zip = zip
  p.grade = grade
  for (const r of store.referrals) {
    if (r.referredId === id) {
      r.referredName = parentName
      r.referredEmail = email
    }
  }
  saveStore(store)
  if (input.children !== undefined) {
    await replaceChildren(id, children)
  }
}

export async function addReferral(
  referrerId: string,
  referredId: string,
): Promise<void> {
  const all = await listParticipants()
  const referrer = all.find((p) => p.id === referrerId)
  const referred = all.find((p) => p.id === referredId)
  if (!referrer || !referred) throw new Error('Participant not found')
  if (referred.referredById) throw new Error('That person already has a referral')
  if (referred.createdAt <= referrer.createdAt) {
    throw new Error('Can only add referrals for people who signed up after this person')
  }

  if (supabase) {
    const { error: upErr } = await supabase
      .from('participants')
      .update({ referred_by_id: referrerId, updated_at: new Date().toISOString() })
      .eq('id', referredId)
    if (upErr) throw upErr
    const { error: insErr } = await supabase.from('referrals').insert({
      referrer_id: referrerId,
      referred_id: referredId,
      referred_name: referred.parentName,
      referred_email: referred.email,
      status: referred.status,
      submission_method: 'staff_attributed',
    })
    if (insErr) throw insErr
    return
  }

  const store = loadStore()
  const referredRow = store.participants.find((p) => p.id === referredId)
  if (!referredRow) throw new Error('Referred participant not found')
  referredRow.referredById = referrerId
  store.referrals.push({
    id: newId(),
    referrerId,
    referredId,
    referredName: referredRow.parentName,
    referredEmail: referredRow.email,
    status: referredRow.status,
    submissionMethod: 'staff_attributed',
    createdAt: new Date().toISOString(),
  })
  saveStore(store)
}


/** Unambiguous suffix alphabet (no 0/1/8/B/I/L/O — B vs 8 mix-ups are common). */
const CODE_SUFFIX_ALPHABET = '2345679ACDEFGHJKMNPQRSTUVWXYZ'

export function generateReferralCode(parentName: string): string {
  const base = parentName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'KID'
  let suffix = ''
  for (let i = 0; i < 3; i++) {
    suffix += CODE_SUFFIX_ALPHABET[Math.floor(Math.random() * CODE_SUFFIX_ALPHABET.length)]
  }
  return `${base}${suffix}`
}

export interface CreateParticipantInput {
  parentName: string
  email: string
  zip: string
  grade: string
  children?: ChildInput[]
  /** Referrer's code from ?ref=, if any */
  referralCodeFromLink?: string | null
  submissionMethod?: SubmissionMethod
}

export async function createParticipant(input: CreateParticipantInput): Promise<Participant> {
  const email = input.email.trim().toLowerCase()
  const parentName = input.parentName.trim()
  const zip = input.zip.trim()
  const children = normalizeChildren(input.children)
  validateChildren(children)
  const grade = gradeFromChildren(children, input.grade.trim())
  const method: SubmissionMethod = input.submissionMethod ?? (input.referralCodeFromLink ? 'link' : 'direct_submit')
  const refFromLink = (input.referralCodeFromLink || '').trim().toUpperCase() || null

  if (!parentName || !email || !/^\d{5}$/.test(zip) || !grade) {
    throw new Error('Name, email, 5-digit zip, and grade (or at least one child) are required')
  }

  if (supabase) {
    let referredById: string | null = null
    if (refFromLink) {
      const { data: referrer } = await supabase
        .from('participants')
        .select('id')
        .eq('referral_code', refFromLink)
        .maybeSingle()
      referredById = (referrer?.id as string | undefined) ?? null
    }

    // Idempotent on email
    const { data: existing } = await supabase
      .from('participants')
      .select('*')
      .ilike('email', email)
      .maybeSingle()

    if (existing) {
      return mapParticipant(existing as Record<string, unknown>)
    }

    let code = generateReferralCode(parentName)
    for (let i = 0; i < 5; i++) {
      const { data, error } = await supabase
        .from('participants')
        .insert({
          parent_name: parentName,
          email,
          zip,
          grade,
          referral_code: code,
          referred_by_id: referredById,
          status: 'waitlisted',
        })
        .select('*')
        .single()
      if (!error && data) {
        const created = mapParticipant(data as Record<string, unknown>)
        if (children.length > 0) {
          await replaceChildren(created.id, children)
        }
        if (referredById) {
          await supabase.from('referrals').insert({
            referrer_id: referredById,
            referred_id: created.id,
            referred_name: parentName,
            referred_email: email,
            status: 'waitlisted',
            submission_method: method,
          })
        }
        return created
      }
      code = generateReferralCode(parentName)
    }
    throw new Error('Could not create participant')
  }

  const store = loadStore()
  const existing = store.participants.find((p) => p.email.toLowerCase() === email)
  if (existing) return existing

  let referredById: string | null = null
  if (refFromLink) {
    referredById = store.participants.find((p) => p.referralCode === refFromLink)?.id ?? null
  }

  let code = generateReferralCode(parentName)
  while (store.participants.some((p) => p.referralCode === code)) {
    code = generateReferralCode(parentName)
  }

  const created: Participant = {
    id: newId(),
    parentName,
    email,
    zip,
    grade,
    referralCode: code,
    referredById,
    status: 'waitlisted',
    createdAt: new Date().toISOString(),
  }
  store.participants.push(created)
  if (referredById) {
    store.referrals.push({
      id: newId(),
      referrerId: referredById,
      referredId: created.id,
      referredName: parentName,
      referredEmail: email,
      status: 'waitlisted',
      submissionMethod: method,
      createdAt: created.createdAt,
    })
  }
  saveStore(store)
  if (children.length > 0) {
    await replaceChildren(created.id, children)
  }
  return created
}


export async function deleteParticipant(id: string): Promise<void> {
  if (supabase) {
    // Clear inbound referred_by links so FK does not block delete
    const { error: clearErr } = await supabase
      .from('participants')
      .update({ referred_by_id: null, updated_at: new Date().toISOString() })
      .eq('referred_by_id', id)
    if (clearErr) throw clearErr

    const { error: refErr } = await supabase.from('referrals').delete().or(
      `referrer_id.eq.${id},referred_id.eq.${id}`,
    )
    if (refErr) throw refErr

    const { error: childErr } = await supabase.from('children').delete().eq('participant_id', id)
    if (childErr) throw childErr

    const { error } = await supabase.from('participants').delete().eq('id', id)
    if (error) throw error
    return
  }

  const store = loadStore()
  store.participants = store.participants.filter((p) => p.id !== id)
  for (const p of store.participants) {
    if (p.referredById === id) p.referredById = null
  }
  store.referrals = store.referrals.filter(
    (r) => r.referrerId !== id && r.referredId !== id,
  )
  store.children = store.children.filter((c) => c.participantId !== id)
  saveStore(store)
}

export async function resetDemoData(): Promise<void> {
  if (isSupabaseConfigured) {
    throw new Error('Reset is only available in mock/local mode')
  }
  localStorage.removeItem(STORAGE_KEY)
}

export function usingMockData(): boolean {
  return !isSupabaseConfigured
}

/** Marketing site origin for invite links. Staging S3 for now; later https://speedrun.gt.school */
export function publicSiteBaseUrl(): string {
  const raw = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return 'http://127.0.0.1:8000'
}

export function signupLinkForCode(code: string): string {
  return `${publicSiteBaseUrl()}/parents.html?ref=${encodeURIComponent(code)}#join`
}
