export type EmployeeEditValues = {
  full_name: string;
  email: string;
  address: string;
  hometown: string;
  id_number: string;
  position: string;
  department: string;
  date_of_birth: string;
  unit_id: string;
};

export function employeeEditPatch(values: EmployeeEditValues, isAdmin: boolean) {
  return {
    full_name: values.full_name.trim(),
    address: values.address.trim() || null,
    hometown: values.hometown.trim() || null,
    id_number: values.id_number.trim() || null,
    position: values.position.trim() || null,
    department: values.department.trim() || null,
    date_of_birth: values.date_of_birth || null,
    unit_id: values.unit_id === "none" ? null : values.unit_id,
    ...(isAdmin ? { email: values.email.trim() || null } : {}),
  };
}