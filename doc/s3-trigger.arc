architecture "S3 with a trigger" {
    AWS "Frankfurt" {
        S3 "Input bucket"
        Lambda "New object processor"
    }
}
relations {
    S3 -> Lambda [ trigger "new object" ]
}
