package com.redcrystal.bio;

import com.suprema.BioMiniSDK;
import com.suprema.ImageSDK;

import java.io.IOException;
import java.util.Base64;

/**
 * Created by Tran on 9/20/2016.
 */
public class Scanner {

    public final BioMiniSDK bio;
    public static ImageSDK libSDK = new ImageSDK();

    final int MAX_TEMPLATE_SIZE = 1024;
    final static int MAX_IMAGE_BUFFER_SIZE = 1000000;

    static long[] hExtractorContainer = new long[1];
    static long[] hMatcherContainer = new long[1];

    public static Callback cb;

    public void setCb(Callback cb) {
        Scanner.cb = cb;
    }

    public Scanner() {
        this.bio = new BioMiniSDK();
    }

    public boolean init() {
        libSDK.UFE_Create(hExtractorContainer);
        libSDK.UFM_Create(hMatcherContainer);

        boolean result = bio.UFS_Init() == bio.UFS_OK;

        if (result) {
            int[] nValue = new int[1];
            nValue[0] = 1;
            bio.UFM_SetParameter(getHandleScanner()[0], bio.UFM_PARAM_FAST_MODE, nValue);
            bio.UFM_SetParameter(getHandleScanner()[0], 321, nValue);

            //set class

            bio.UFS_SetClassName("com.redcrystal.bio.Scanner");
        }

        return result;
    }

    public long[] getHandleScanner() {
        int ufs_res;
        long[] hScanner = new long[1];
        ufs_res = bio.UFS_GetScannerHandle(0, hScanner);
        if (ufs_res == bio.UFS_OK) return hScanner;
        return null;
    }

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

    public void captureCallback(int bFingerOn, byte[] pImage, int nWidth, int nHeight, int nResolution) {
        String image64 = convertToJpg(nWidth, nHeight, pImage);

        if (Scanner.cb != null) {
            Scanner.cb.action(image64);
        }
    }

    public ScannerResult scan() {

        long handleNr = getHandleScanner()[0];

        checkConnected(handleNr);

        bio.UFS_ClearCaptureImageBuffer(handleNr);

        int nRes = bio.UFS_CaptureSingleImage(handleNr);

        if (nRes != 0) return null;

        byte[] bTemplate = new byte[MAX_TEMPLATE_SIZE];

        int[] refTemplateSize = new int[1];

        int[] refTemplateQuality = new int[1];

        try {

            nRes = bio.UFS_ExtractEx(handleNr, MAX_TEMPLATE_SIZE, bTemplate, refTemplateSize, refTemplateQuality);

            if (nRes != 0) return null;

            String template = Base64.getEncoder().encodeToString(bTemplate);

            int[] nWidth = new int[1];
            int[] nHeight = new int[1];
            int[] nResolution = new int[1];

            bio.UFS_GetCaptureImageBufferInfo(handleNr, nWidth, nHeight, nResolution);

            byte[] pImageData = new byte[nWidth[0] * nHeight[0]];
            bio.UFS_GetCaptureImageBuffer(handleNr, pImageData);

            String image64;

            image64 = convertToJpg(nWidth[0], nHeight[0], pImageData);

            // quality
            int[] pnFPQuality = new int[1];

            bio.UFS_GetFPQuality(handleNr, pImageData, nWidth[0], nHeight[0], pnFPQuality);

            return new ScannerResult(template, image64, refTemplateSize[0], pnFPQuality[0]);

        } catch (Exception ex) {

        }

        return null;
    }

    private String convertToJpg(int width, int height, byte[] pImageData) {
        String image64;
        byte[] pImageOut = new byte[MAX_IMAGE_BUFFER_SIZE];
        int[] ImageLengthOut = new int[1];

        libSDK.UFE_GetImageBufferToJPEGImageBuffer(hExtractorContainer[0], pImageData, width, height, pImageOut, ImageLengthOut);

        byte[] templateToSave = new byte[ImageLengthOut[0]];
        System.arraycopy(pImageOut, 0, templateToSave, 0, ImageLengthOut[0]);

        image64 = Base64.getEncoder().encodeToString(templateToSave);
        return image64;
    }

    public void autoScan() {

        System.out.println("auto scan ...");

        long handleNr = getHandleScanner()[0];

        checkConnected(handleNr);

        bio.UFS_ClearCaptureImageBuffer(handleNr);

        bio.UFS_StartAutoCapture(handleNr, "captureCallback");

    }

    private void checkConnected(long handleNr) {
        int[] pbSensorOn = new int[1];

        bio.UFS_IsSensorOn(handleNr, pbSensorOn );

        if (pbSensorOn[0] == 0) init();
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner();
        scanner.init();
        scanner.autoScan();

        try {
            System.in.read();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
