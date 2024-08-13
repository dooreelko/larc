architecture "S3 with a trigger" {
    AWS {
        Region "Frankfurt" {

            Lambda "New object processor"
            
            S3 "Input bucket" 
        }
    }
}

relations {
    S3 -> Lambda [ description "new object added" ]
}
