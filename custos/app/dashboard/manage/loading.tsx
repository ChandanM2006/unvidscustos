export default function ManageLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 lg:p-8 animate-pulse">
            {/* Back button & header skeleton */}
            <div className="mb-8">
                <div className="h-6 w-24 bg-gray-200 rounded mb-4" />
                <div className="h-8 w-56 bg-gray-200 rounded-lg mb-2" />
                <div className="h-4 w-72 bg-gray-200 rounded-lg" />
            </div>

            {/* Grid of management cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(9)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 bg-gray-200 rounded-xl" />
                            <div className="h-5 w-28 bg-gray-200 rounded" />
                        </div>
                        <div className="h-3 w-full bg-gray-100 rounded mb-1" />
                        <div className="h-3 w-2/3 bg-gray-100 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
