export default function TeacherLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 lg:p-8 animate-pulse">
            {/* Header skeleton */}
            <div className="mb-8">
                <div className="h-8 w-48 bg-gray-200 rounded-lg mb-2" />
                <div className="h-4 w-80 bg-gray-200 rounded-lg" />
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm p-5">
                        <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
                        <div className="h-7 w-12 bg-gray-200 rounded" />
                    </div>
                ))}
            </div>

            {/* Action grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center">
                        <div className="h-12 w-12 bg-gray-200 rounded-xl mb-3" />
                        <div className="h-4 w-20 bg-gray-200 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
