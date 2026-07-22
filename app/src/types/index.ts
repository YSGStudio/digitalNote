export type RepairStatus = '접수 대기' | '수리 중' | '처리 완료'
export type RentalStatus = '대여 중' | '반납 요청 중' | '반납 완료'
export type TeacherLoanStatus = '대여중' | '반납완료'

export interface SchoolConfig {
  id: string
  school_name: string
  school_code: string
}

export interface Classroom {
  id: string
  school_id: string
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
  school_id: string
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
  school_id: string
  device_name: string
  total_quantity: number
  available_quantity: number
  is_active: boolean
  created_at: string
}

export interface Rental {
  id: string
  school_id: string
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
  school_id: string
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
  school_id: string
}

export interface Student {
  id: string
  school_id: string
  name: string
  grade: string | null
  class_name: string | null
  student_number: string | null
  created_at: string
  chromebooks?: Chromebook[]
}

export interface Chromebook {
  id: string
  school_id: string
  device_number: string
  device_year: string | null
  student_id: string | null
  assigned_at: string | null
  created_at: string
  students?: Student
}

export interface TeacherDeviceLoan {
  id: string
  school_id: string
  status: TeacherLoanStatus

  borrower_name: string
  device_type: string | null
  device_etc: string | null
  model: string | null
  asset_no: string | null
  parts: string[] | null
  parts_etc: string | null
  note: string | null
  rent_date: string
  sig_borrower: string
  sig_manager_out: string
  manager_out_name: string

  return_date: string | null
  condition: string | null
  condition_etc: string | null
  return_note: string | null
  sig_returner: string | null
  sig_manager_in: string | null
  manager_in_name: string | null

  created_at: string
  updated_at: string
}
