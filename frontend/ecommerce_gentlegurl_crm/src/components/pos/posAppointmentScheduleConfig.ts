/** Full-day schedule grid (24 hours). */
export const POS_APPOINTMENT_SCHEDULE_START_HOUR = 0
export const POS_APPOINTMENT_SCHEDULE_END_HOUR = 24

export const POS_APPOINTMENT_SLOT_MINUTES = 15
export const POS_APPOINTMENT_SLOT_PX = 18

export const POS_APPOINTMENT_DAY_START_MIN = POS_APPOINTMENT_SCHEDULE_START_HOUR * 60
export const POS_APPOINTMENT_DAY_END_MIN = POS_APPOINTMENT_SCHEDULE_END_HOUR * 60

export const formatPosAppointmentScheduleRangeLabel = () => '24-hour schedule'
