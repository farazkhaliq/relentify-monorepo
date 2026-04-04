import { NextRequest, NextResponse } from 'next/server'
import { updateCallRecord } from '@/lib/services/voice.service'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const recordingUrl = formData.get('RecordingUrl') as string
    const recordingDuration = formData.get('RecordingDuration') as string
    const type = req.nextUrl.searchParams.get('type')

    const statusMap: Record<string, string> = {
      'completed': 'completed', 'busy': 'missed', 'no-answer': 'missed',
      'failed': 'missed', 'canceled': 'missed',
    }

    const updates: any = {}
    if (callStatus) updates.status = statusMap[callStatus] || callStatus
    if (callStatus === 'completed' || callStatus === 'canceled') updates.ended_at = new Date().toISOString()
    if (callStatus === 'in-progress') updates.answered_at = new Date().toISOString()
    if (recordingUrl) updates.recording_url = recordingUrl
    if (recordingDuration) updates.recording_duration_seconds = parseInt(recordingDuration, 10)
    if (type === 'voicemail' && recordingUrl) updates.voicemail_url = recordingUrl

    if (callSid) await updateCallRecord(callSid, updates)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Voice status error:', err)
    return NextResponse.json({ ok: true }) // Always 200 for Twilio
  }
}
