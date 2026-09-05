export function toUserDto(user) {
    return {
        id: user.publicId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
    };
}
export function toUserSummaryDto(user) {
    return {
        id: user.publicId,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
    };
}
export function toCategoryDto(category) {
    return {
        id: category.publicId,
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
    };
}
export function toPortfolioImageDto(image) {
    return {
        id: image.publicId,
        url: image.url,
        caption: image.caption,
        sortOrder: image.sortOrder,
    };
}
export function toContractorDto(profile) {
    return {
        id: profile.publicId,
        user: toUserSummaryDto(profile.user),
        businessName: profile.businessName,
        bio: profile.bio,
        yearsInBusiness: profile.yearsInBusiness,
        licenseNumber: profile.licenseNumber,
        city: profile.city,
        state: profile.state,
        zip: profile.zip,
        serviceRadiusMiles: profile.serviceRadiusMiles,
        hourlyRateMin: profile.hourlyRateMin,
        hourlyRateMax: profile.hourlyRateMax,
        ratingAverage: profile.ratingAverage,
        reviewCount: profile.reviewCount,
        categories: (profile.categories ?? []).map(toCategoryDto),
        portfolio: (profile.portfolio ?? [])
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(toPortfolioImageDto),
    };
}
export function toQuoteDto(quote) {
    return {
        id: quote.publicId,
        projectId: quote.project?.publicId ?? '',
        contractor: toContractorDto(quote.contractor),
        amount: quote.amount,
        estimatedDays: quote.estimatedDays,
        message: quote.message,
        status: quote.status,
        createdAt: quote.createdAt.toISOString(),
    };
}
export function toReviewDto(review) {
    return {
        id: review.publicId,
        projectId: review.project?.publicId ?? '',
        projectTitle: review.projectTitle,
        homeowner: toUserSummaryDto(review.homeowner),
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
    };
}
export function toProjectDto(project) {
    return {
        id: project.publicId,
        homeowner: toUserSummaryDto(project.homeowner),
        category: toCategoryDto(project.category),
        title: project.title,
        description: project.description,
        city: project.city,
        state: project.state,
        zip: project.zip,
        budgetMin: project.budgetMin,
        budgetMax: project.budgetMax,
        preferredStartDate: project.preferredStartDate,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
        quotes: (project.quotes ?? []).map((quote) => ({
            ...toQuoteDto(quote),
            projectId: project.publicId,
        })),
        review: project.review
            ? { ...toReviewDto(project.review), projectId: project.publicId }
            : null,
    };
}
//# sourceMappingURL=serializers.js.map