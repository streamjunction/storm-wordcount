var testApp = angular.module("test", [ 
  "angularFileUpload"
]);


testApp.controller("TestController", ["$scope", "$location", "$http", "$upload",
  function ($scope, $location, $http, $upload) {
    
    function formDataObject(data) {
      var fd = new FormData();
      angular.forEach(data, function(value, key) {
        fd.append(key, value);
      });
      return fd;
    }
    
    $scope.onFileSelect = function ($files) {
      if ($files.length > 0) {
        var file = $files[0];
        $scope.uploadCompleted = false;
        $scope.uploadFailure = false;
        $scope.showProgress = true;
        
        $upload.upload({
          url: "/api/sendWords",
          file: file
        }).progress(function (event) {
          $scope.progress = Math.floor(100*event.loaded /event.total);
        }).success(function () {
          $scope.uploadCompleted = true;
          $scope.showProgress = false;
        }).error(function () {
          $scope.uploadFailure = true;
          $scope.showProgress = false;
        });
      }
    };
    
    $scope.getWordCount = function () {
      $scope.showWordCount = false;
      $scope.wordCountError = false;
      var w = ($scope.words || "").trim();
      if (w.length > 0) {
        $http({
          url: "/api/getWordCount",
          method: "GET",
          params: { words: w }
        }).success(function (data) {
          $scope.showWordCount = true;
          $scope.wordsToCount = w;
          $scope.wordCount = data;
        }).error(function () {
          $scope.wordCountError = true;
        });
      }
    };
    
    $scope.uploadCompleted = false;
    $scope.uploadFailure = false;
    $scope.showProgress = false;
    $scope.showWordCount = false;
    $scope.wordCountError = false;
    
  }]);

