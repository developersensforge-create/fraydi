import Navbar from '@/components/Navbar'
import FamilyTimeline from '@/components/FamilyTimeline'
import CoordinationAlert from '@/components/CoordinationAlert'
import ShoppingList from '@/components/ShoppingList'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Good morning 👋</h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your family today.</p>
        </div>

        {/* Coming soon banner */}
        <div className="mb-8 rounded-xl bg-orange-50 border border-orange-100 px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="font-semibold text-orange-900">Dashboard coming soon</p>
            <p className="text-sm text-orange-700">
              We're building out the full experience. Check back soon — it's going to be great.
            </p>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Family Timeline — spans 2 cols on large */}
          <div className="lg:col-span-2">
            <FamilyTimeline />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            <CoordinationAlert />
            <ShoppingList />
          </div>
        </div>
      </main>
    </div>
  )
}
