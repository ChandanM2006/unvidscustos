export default function DashboardLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 lg:p-8 animate-pulse">
            {/* Header skeleton */}
            <div className="mb-8">
                <div className="h-8 w-64 bg-gray-200 rounded-lg mb-2" />
                <div className="h-4 w-96 bg-gray-200 rounded-lg" />
            </div>

            {/* Stats cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm p-6">
                        <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
                        <div className="h-8 w-16 bg-gray-200 rounded mb-2" />
                        <div className="h-3 w-24 bg-gray-100 rounded" />
                    </div>
                ))}
            </div>

            {/* Content skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-gray-200 rounded-full" />
                                <div className="flex-1">
                                    <div className="h-4 w-3/4 bg-gray-200 rounded mb-1" />
                                    <div className="h-3 w-1/2 bg-gray-100 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-100 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
