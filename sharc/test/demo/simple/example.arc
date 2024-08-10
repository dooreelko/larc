architecture "S3 with a trigger" {
    AWS "Frankfurt" {
        Lambda "New object processor"
        
        S3 "Input bucket" {
            Foo "Baa r"
            Moo "Fa ar"
        }
    }

}

relations {
    S3 -> Lambda [ trigger "new object" ]
}
