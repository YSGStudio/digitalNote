export type RepairStatus = '접수 대기' | '수리 중' | '처리 완료'
export type RentalStatus = '대여 중' | '반납 요청 중' | '반납 완료'

export interface SchoolConfig {
  id: string
  school_name: string
  school_code: string
}

export interface Classroom {
  id: string
  class_name: string
  teacher_name: string | null
  created_at: string
}

export interface Device {
  id: string
  device_type: string
  description: string | null
}

export interface ClassroomDevice {
  id: string
  classroom_id: string
  device_id: string
  quantity: number
  updated_at?: string
  devices?: Device
  classrooms?: Classroom
}

export interface RepairReport {
  id: string
  classroom_id: string
  device_id: string
  quantity: number
  description: string | null
  status: RepairStatus
  reported_at: string
  resolved_at: string | null
  classrooms?: Classroom
  devices?: Device
}

export interface SharedDevice {
  id: string
  device_name: string
  total_quantity: number
  available_quantity: number
  is_active: boolean
  created_at: string
}

export interface Rental {
  id: string
  classroom_id: string
  device_id: string
  quantity: number
  description: string | null
  rented_at: string
  returned_at: string | null
  status: RentalStatus
  classrooms?: Classroom
  shared_devices?: SharedDevice
}

export interface TutorSupport {
  id: string
  classroom_id: string
  support_date: string
  period: string
  content: string
  created_at: string
  classrooms?: Classroom
}

export interface TeacherSession {
  classroomId: string
  className: string
  teacherName: string
}
