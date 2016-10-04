package com.redcrystal.bio;

/**
 * Created by Giang on 9/26/2016.
 */
class ScannerResult {
    public ScannerResult(String template, String image, int size, int quality) {
        this.template = template;
        this.image = image;
        this.size = size;
        this.quality = quality;
    }

    public String template;
    public String image;
    public int size;
    public int quality;
}
