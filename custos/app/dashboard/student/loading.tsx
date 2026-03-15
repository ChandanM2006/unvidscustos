export default function StudentLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 lg:p-8 animate-pulse">
            {/* Header skeleton */}
            <div className="mb-8">
                <div className="h-8 w-48 bg-gray-200 rounded-lg mb-2" />
                <div className="h-4 w-72 bg-gray-200 rounded-lg" />
            </div>

            {/* Progress overview */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                <div className="h-5 w-36 bg-gray-200 rounded mb-4" />
                <div className="flex items-center gap-4">
                    <div className="h-20 w-20 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-full bg-gray-100 rounded-full" />
                        <div className="h-3 w-48 bg-gray-100 rounded" />
                    </div>
                </div>
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center">
                        <div className="h-12 w-12 bg-gray-200 rounded-xl mb-3" />
                        <div className="h-4 w-20 bg-gray-200 rounded mb-1" />
                        <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
