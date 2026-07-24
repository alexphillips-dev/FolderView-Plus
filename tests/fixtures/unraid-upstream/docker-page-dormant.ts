export default {
    async shouldApply() {
        return {
            shouldApply: false,
            reason: '',
        };
    },
    template: '<unraid-docker-container-overview></unraid-docker-container-overview>',
};
