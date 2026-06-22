/** Full-day schedule grid (midnight–midnight). */
export const POS_APPOINTMENT_SCHEDULE_START_HOUR = 0
export const POS_APPOINTMENT_SCHEDULE_END_HOUR = 24

export const POS_APPOINTMENT_SLOT_MINUTES = 15
export const POS_APPOINTMENT_SLOT_PX = 18

export const POS_APPOINTMENT_DAY_START_MIN = POS_APPOINTMENT_SCHEDULE_START_HOUR * 60
export const POS_APPOINTMENT_DAY_END_MIN = POS_APPOINTMENT_SCHEDULE_END_HOUR * 60

export const POS_SCHEDULE_TZ = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Kuala_Lumpur'

export const formatPosAppointmentScheduleRangeLabel = () => '12-hour clock'
