'strict mode';

// Local images
const images = require("../images/images.json").images.map((img,i)=>({...img, image_id:i}));
module.exports = {
    fetchList: async function (from, count) {
        return images.slice(from, from + count);
    },
    fetchImage: async function (obj, advicedResolution) {
        const encodedFile = encodeURIComponent(obj.file);
        const displayFile = obj.file.replace(/\.(jpe?g|png)$/i, ".webp");
        let response;
        if (displayFile !== obj.file) {
            // Pages deployment generates lightweight WebP display copies.
            // Keep original files as a fallback for local development or missing conversions.
            response = await fetch("images/display/" + encodeURIComponent(displayFile));
            if (!response.ok) response = await fetch("images/" + encodedFile);
        } else {
            response = await fetch("images/" + encodedFile);
        }
        if (!response.ok) throw new Error("Could not load image: " + obj.file);
        const blob = await response.blob();
        return {
            title: obj.title,
            image: blob
        };
    }
};
