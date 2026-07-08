import { ActionButtons } from "./ActionButtons";
import { StatusBadge } from "./StatusBadge";

type Astrologer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  experience: string;
  languages: string;
  specialties: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
};

const astrologers: Astrologer[] = [
  {
    id: "1",
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "+91 9876543210",
    experience: "6 years",
    languages: "Hindi, English",
    specialties: "Marriage, Career",
    status: "PENDING",
  },
  {
    id: "2",
    name: "Rahul Joshi",
    email: "rahul@example.com",
    phone: "+91 9876501234",
    experience: "10 years",
    languages: "Hindi, Gujarati",
    specialties: "Kundli, Vastu",
    status: "APPROVED",
  },
];

export function AstrologerTable() {
  function handleAction(action: string, id: string) {
    alert(`${action} astrologer ${id}. Backend API next.`);
  }

  return (
    <div className="mt-10 rounded-2xl bg-white p-6 shadow">
      <h2 className="text-2xl font-bold text-[#0B1026]">
        Astrologer Approval Management
      </h2>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-4">Name</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Experience</th>
              <th className="p-4">Languages</th>
              <th className="p-4">Specialties</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {astrologers.map((astrologer) => (
              <tr key={astrologer.id} className="border-b">
                <td className="p-4 font-semibold">{astrologer.name}</td>
                <td className="p-4">
                  <div>{astrologer.email}</div>
                  <div className="text-sm text-gray-500">{astrologer.phone}</div>
                </td>
                <td className="p-4">{astrologer.experience}</td>
                <td className="p-4">{astrologer.languages}</td>
                <td className="p-4">{astrologer.specialties}</td>
                <td className="p-4">
                  <StatusBadge status={astrologer.status} />
                </td>
                <td className="p-4">
                  <ActionButtons
                    onApprove={() => handleAction("Approve", astrologer.id)}
                    onReject={() => handleAction("Reject", astrologer.id)}
                    onSuspend={() => handleAction("Suspend", astrologer.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}