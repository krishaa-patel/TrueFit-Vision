import numpy as np
import cv2
from PIL import Image
from transformers import pipeline

segmenter = pipeline(model="mattmdjaga/segformer_b2_clothes")


def auto_detect_reference_width(image_cv, expected_ratio=29.7 / 21.0, ratio_tolerance=0.2):
    """
    Tries to automatically find an A4 sheet in the photo and return its
    longer side length in pixels. Returns None if no confident match is
    found, so the caller can fall back to a manual value.
    """
    hsv = cv2.cvtColor(image_cv, cv2.COLOR_BGR2HSV)

    lower_white = np.array([0, 0, 200])
    upper_white = np.array([180, 30, 255])
    mask_white = cv2.inRange(hsv, lower_white, upper_white)

    contours, _ = cv2.findContours(mask_white, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_candidate = None
    best_score = -1
    image_area = image_cv.shape[0] * image_cv.shape[1]

    for c in contours:
        area = cv2.contourArea(c)
        if area < image_area * 0.01 or area > image_area * 0.6:
            continue

        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.03 * peri, True)
        if len(approx) != 4:
            continue

        x, y, w, h = cv2.boundingRect(c)
        long_side, short_side = max(w, h), min(w, h)
        if short_side == 0:
            continue

        ratio = long_side / short_side
        ratio_diff = abs(ratio - expected_ratio)

        if ratio_diff <= ratio_tolerance:
            rect_fill = area / (w * h)
            score = area * rect_fill * (1 - ratio_diff)
            if score > best_score:
                best_score = score
                best_candidate = long_side

    return best_candidate


def process_garment_image(image_path, reference_object_width_px=None, reference_object_cm=21.0):
    img = Image.open(image_path)
    if img.width > img.height:
        img = img.rotate(-90, expand=True)

    reference_auto_detected = False
    if reference_object_width_px is None:
        image_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        detected = auto_detect_reference_width(image_cv)
        if detected is not None:
            reference_object_width_px = detected
            reference_auto_detected = True
        else:
            raise ValueError(
                "Could not automatically detect the reference object (A4 sheet) in this photo. "
                "Please provide reference_object_width_px manually."
            )

    segments = segmenter(img)
    garment_mask = None
    for s in segments:
        if s['label'] in ["Dress", "Upper-clothes"]:
            garment_mask = s['mask']

    mask_array = np.array(garment_mask)
    mask_uint8 = (mask_array > 0).astype(np.uint8) * 255

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask_uint8, connectivity=8)
    largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    clean_mask = (labels == largest_label).astype(np.uint8)

    ys, xs = np.where(clean_mask > 0)

    pixels_per_cm = reference_object_width_px / reference_object_cm

    top_y, bottom_y = ys.min(), ys.max()
    garment_height = bottom_y - top_y

   # ---------------------------------------------------------
# CHEST WIDTH
#
# Measure through the torso rather than selecting the
# narrowest rows. The upper rows often contain sleeves,
# while choosing the narrowest rows biases chest downward.
# ---------------------------------------------------------

    widths = []
    
    for pct in np.arange(0.38, 0.68, 0.01):
    
        row = top_y + int(garment_height * pct)
    
        row_xs = xs[ys == row]
    
        if len(row_xs) > 0:
    
            row_width = row_xs.max() - row_xs.min()
    
            widths.append(row_width)
    
    
    if not widths:
        raise ValueError("Could not determine garment chest width.")
    
    
    widths = np.array(widths, dtype=float)
    
    
    # Remove unusual segmentation rows
    q1 = np.percentile(widths, 25)
    q3 = np.percentile(widths, 75)
    
    iqr = q3 - q1
    
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    
    clean_widths = widths[
        (widths >= lower) &
        (widths <= upper)
    ]
    
    
    if len(clean_widths) == 0:
        clean_widths = widths
    
    
    # Median torso width gives a much more stable chest estimate
    chest_width_px = np.median(clean_widths)
    
    chest_width_cm = chest_width_px / pixels_per_cm
    
    
    # ---------------------------------------------------------
    # GARMENT LENGTH
    # ---------------------------------------------------------
    
    length_px = bottom_y - top_y
    
    length_cm = length_px / pixels_per_cm

    return {
        "chest_cm": round(float(chest_width_cm), 2),
        "length_cm": round(float(length_cm), 2),
        "reference_auto_detected": reference_auto_detected,
        "reference_object_width_px_used": round(float(reference_object_width_px), 1)
    }